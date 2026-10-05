import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { requestOtp, verifyOtp, logout, refreshAccessToken } from './auth.controller.js';
import { prisma } from '../utils/prisma.js';
import { deliverOtp } from '../utils/otpDelivery.js';
import { signRefreshToken } from '../utils/jwt.js';

vi.mock('../utils/prisma.js', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

vi.mock('../utils/otpDelivery.js', () => ({
    normalizeContact: (contact) => ({ isEmail: true, value: contact.trim().toLowerCase() }),
    deliverOtp: vi.fn(async () => 'email'),
}));

const EMAIL = 'traveler@pickandsync.com';
const hash = (code) => createHash('sha256').update(`${EMAIL}:${code}`).digest('hex');

const mockRes = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
});

describe('auth controller', () => {
    let res;

    beforeEach(() => {
        vi.clearAllMocks();
        res = mockRes();
        process.env.JWT_SECRET = 'test_secret';
        process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    });

    describe('requestOtp', () => {
        it('stores a hashed 6-digit code, never the plain code', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: EMAIL, otpExpiresAt: null });
            prisma.user.update.mockResolvedValue({});

            await requestOtp({ body: { contact: EMAIL } }, res);

            const sentCode = deliverOtp.mock.calls[0][0].otpCode;
            expect(sentCode).toMatch(/^\d{6}$/);
            const stored = prisma.user.update.mock.calls[0][0].data;
            expect(stored.otpCode).toBe(hash(sentCode));
            expect(stored.otpCode).not.toBe(sentCode);
            expect(stored.otpAttempts).toBe(0);
        });

        it('rejects a resend within the cooldown window', async () => {
            const justIssued = new Date(Date.now() + 10 * 60 * 1000 - 5000);
            prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: EMAIL, otpExpiresAt: justIssued });

            await expect(requestOtp({ body: { contact: EMAIL } }, res))
                .rejects.toMatchObject({ statusCode: 429 });
            expect(deliverOtp).not.toHaveBeenCalled();
        });

        it('treats register on a never-verified account as a resend', async () => {
            const issuedLongAgo = new Date(Date.now() + 10 * 60 * 1000 - 120000);
            prisma.user.findUnique.mockResolvedValue({
                id: 'u1', email: EMAIL, otpCode: 'pending-hash', otpExpiresAt: issuedLongAgo, refreshToken: null,
            });
            prisma.user.update.mockResolvedValue({});

            await requestOtp({ body: { contact: EMAIL, name: 'A', isRegister: true } }, res);

            expect(prisma.user.create).not.toHaveBeenCalled();
            expect(prisma.user.update).toHaveBeenCalled();
            expect(deliverOtp).toHaveBeenCalled();
        });

        it('refuses to register an existing account', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: EMAIL });
            await expect(requestOtp({ body: { contact: EMAIL, name: 'A', isRegister: true } }, res))
                .rejects.toMatchObject({ statusCode: 409 });
        });
    });

    describe('verifyOtp', () => {
        const pendingUser = (overrides = {}) => ({
            id: 'u1',
            email: EMAIL,
            name: 'Traveler',
            otpCode: hash('123456'),
            otpExpiresAt: new Date(Date.now() + 60000),
            otpAttempts: 0,
            isBanned: false,
            refreshToken: 'old',
            ...overrides,
        });

        it('issues tokens for the right code and consumes it', async () => {
            prisma.user.findUnique.mockResolvedValue(pendingUser());
            prisma.user.updateMany.mockResolvedValue({ count: 1 });
            prisma.user.update.mockResolvedValue({});

            await verifyOtp({ body: { contact: EMAIL, otpCode: '123456' } }, res);

            expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
            }));
            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(true);
            expect(body.accessToken).toBeTruthy();
            expect(body.user.otpCode).toBeUndefined();
            expect(body.user.refreshToken).toBeUndefined();
        });

        it('counts a wrong code as a failed attempt', async () => {
            prisma.user.findUnique.mockResolvedValue(pendingUser());
            prisma.user.update.mockResolvedValue({ otpAttempts: 1 });

            await expect(verifyOtp({ body: { contact: EMAIL, otpCode: '000000' } }, res))
                .rejects.toMatchObject({ statusCode: 401 });
            expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { otpAttempts: { increment: 1 } },
            }));
        });

        it('burns the code after too many wrong attempts', async () => {
            prisma.user.findUnique.mockResolvedValue(pendingUser({ otpAttempts: 4 }));
            prisma.user.update
                .mockResolvedValueOnce({ otpAttempts: 5 })
                .mockResolvedValueOnce({});

            await expect(verifyOtp({ body: { contact: EMAIL, otpCode: '000000' } }, res))
                .rejects.toMatchObject({ statusCode: 429 });
            expect(prisma.user.update).toHaveBeenLastCalledWith(expect.objectContaining({
                data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
            }));
        });

        it('rejects an expired code', async () => {
            prisma.user.findUnique.mockResolvedValue(pendingUser({ otpExpiresAt: new Date(Date.now() - 1000) }));
            await expect(verifyOtp({ body: { contact: EMAIL, otpCode: '123456' } }, res))
                .rejects.toMatchObject({ statusCode: 401 });
        });

        it('rejects when a concurrent request already consumed the code', async () => {
            prisma.user.findUnique.mockResolvedValue(pendingUser());
            prisma.user.updateMany.mockResolvedValue({ count: 0 });
            await expect(verifyOtp({ body: { contact: EMAIL, otpCode: '123456' } }, res))
                .rejects.toMatchObject({ statusCode: 401 });
        });
    });

    describe('refreshAccessToken', () => {
        it('rotates a valid refresh token', async () => {
            const token = signRefreshToken('u1');
            prisma.user.findUnique.mockResolvedValue({ id: 'u1', refreshToken: token, isBanned: false });
            prisma.user.update.mockResolvedValue({});

            await refreshAccessToken({ cookies: {}, body: { refreshToken: token } }, res);

            const body = res.json.mock.calls[0][0];
            expect(body.accessToken).toBeTruthy();
            expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
        });

        it('rejects a refresh token that is no longer the stored one', async () => {
            const token = signRefreshToken('u1');
            prisma.user.findUnique.mockResolvedValue({ id: 'u1', refreshToken: 'rotated', isBanned: false });
            await expect(refreshAccessToken({ cookies: {}, body: { refreshToken: token } }, res))
                .rejects.toMatchObject({ statusCode: 401 });
        });
    });

    describe('logout', () => {
        it('clears the stored refresh token and both cookies', async () => {
            prisma.user.update.mockResolvedValue({});

            await logout({ user: { id: 'u1' } }, res);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'u1' },
                data: { refreshToken: null },
            });
            // Cleared with the same attributes they were set with, otherwise
            // the browser keeps the cookies.
            expect(res.clearCookie).toHaveBeenCalledWith(
                'access_token',
                expect.objectContaining({ httpOnly: true, path: '/' }),
            );
            expect(res.clearCookie).toHaveBeenCalledWith(
                'refresh_token',
                expect.objectContaining({ httpOnly: true, path: '/' }),
            );
        });
    });
});
