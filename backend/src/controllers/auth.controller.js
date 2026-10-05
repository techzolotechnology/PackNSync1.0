import jwt from 'jsonwebtoken';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { prisma } from '../utils/prisma.js';
import { signAccessToken, signRefreshToken, setCookies, clearCookies } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { normalizeContact, deliverOtp } from '../utils/otpDelivery.js';
import { findReferrerId } from '../utils/referrals.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = (email, code) =>
    createHash('sha256').update(`${email}:${String(code).trim()}`).digest('hex');

const otpMatches = (email, code, storedHash) => {
    if (!storedHash || !code) return false;
    const a = Buffer.from(hashOtp(email, code), 'hex');
    const b = Buffer.from(String(storedHash), 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
};

// POST /api/auth/request-otp
export const requestOtp = async (req, res) => {
    const { contact, name, isRegister, referralCode } = req.body;
    if (!contact) throw new AppError('Email address is required.', 400);

    const { value: email } = normalizeContact(contact);
    const query = { email };

    let user = await prisma.user.findUnique({ where: query });

    // A registration that was started but never verified (code still pending,
    // never signed in) is a resend, not a duplicate account.
    const pendingRegistration = Boolean(user && user.otpCode && !user.refreshToken);
    if (isRegister && user && !pendingRegistration) {
        throw new AppError('Account already exists. Please log in.', 409);
    }
    if (!isRegister && !user) {
        throw new AppError('Account not found. Please register.', 404);
    }
    if (isRegister && !name?.trim()) {
        throw new AppError('Name is required for registration.', 400);
    }

    // Throttle resends per account (the previous code was issued at expiry - TTL).
    if (user?.otpExpiresAt) {
        const issuedAt = user.otpExpiresAt.getTime() - OTP_TTL_MS;
        if (Date.now() - issuedAt < OTP_RESEND_COOLDOWN_MS) {
            throw new AppError('Please wait a minute before requesting another code.', 429);
        }
    }

    const otpCode = randomInt(100000, 1000000).toString();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    const otpFields = { otpCode: hashOtp(email, otpCode), otpExpiresAt, otpAttempts: 0 };
    const channel = await deliverOtp({ contact: email, otpCode });

    if (isRegister && !user) {
        const referredById = referralCode ? await findReferrerId(referralCode) : null;
        user = await prisma.user.create({
            data: {
                email,
                name: name.trim().slice(0, 60),
                ...otpFields,
                ...(referredById ? { referredById } : {}),
            },
        });
    } else {
        user = await prisma.user.update({
            where: { id: user.id },
            data: otpFields,
        });
    }

    res.json({
        success: true,
        channel,
        message: channel === 'console'
            ? 'OTP printed in the backend terminal (email provider cannot deliver to this address).'
            : 'OTP sent to your email.',
    });
};

// POST /api/auth/verify-otp
export const verifyOtp = async (req, res) => {
    const { contact, otpCode } = req.body;
    if (!contact || !otpCode) throw new AppError('Email and OTP are required.', 400);

    const { value: email } = normalizeContact(contact);
    const query = { email };

    const user = await prisma.user.findUnique({ where: query });
    if (!user) throw new AppError('Invalid request.', 401);
    if (user.isBanned) {
        throw new AppError(
            user.banReason ? `Account suspended: ${user.banReason}` : 'Your account has been suspended.',
            403
        );
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
        throw new AppError('Invalid or expired OTP.', 401);
    }

    if (!otpMatches(email, otpCode, user.otpCode)) {
        // Count the failure atomically; burn the code after too many tries.
        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { otpAttempts: { increment: 1 } },
            select: { otpAttempts: true },
        });
        if (updated.otpAttempts >= OTP_MAX_ATTEMPTS) {
            await prisma.user.update({
                where: { id: user.id },
                data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
            });
            throw new AppError('Too many incorrect attempts. Request a new code.', 429);
        }
        throw new AppError('Invalid or expired OTP.', 401);
    }

    // Consume the code exactly once, even if two verify requests race.
    const consumed = await prisma.user.updateMany({
        where: { id: user.id, otpCode: user.otpCode },
        data: { otpCode: null, otpExpiresAt: null, otpAttempts: 0 },
    });
    if (consumed.count === 0) throw new AppError('Invalid or expired OTP.', 401);

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });
    setCookies(res, accessToken, refreshToken);

    const { refreshToken: _, otpCode: __, otpExpiresAt: ___, otpAttempts: ____, ...safeUser } = user;
    res.json({ success: true, user: safeUser, accessToken, refreshToken });
};

// POST /api/auth/logout
export const logout = async (req, res) => {
    const userId = req.user?.id;
    if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    }
    clearCookies(res);
    res.json({ success: true, message: 'Logged out successfully.' });
};

// POST /api/auth/refresh
export const refreshAccessToken = async (req, res) => {
    // Cookie first; the body copy keeps sessions alive for browsers that block
    // third-party cookies on the cross-domain API.
    const token = req.cookies?.refresh_token || req.body?.refreshToken;
    if (!token) throw new AppError('No refresh token.', 401);

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
        throw new AppError('Invalid or expired refresh token.', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || user.refreshToken !== token) throw new AppError('Invalid refresh token.', 401);
    if (user.isBanned) {
        clearCookies(res);
        throw new AppError(
            user.banReason ? `Account suspended: ${user.banReason}` : 'Your account has been suspended.',
            403
        );
    }

    // Keep an admin's two-factor session across refreshes (it expires on its own).
    const claims = decoded.mfaAt ? { mfaAt: decoded.mfaAt } : {};
    const accessToken = signAccessToken(user.id, claims);
    const newRefreshToken = signRefreshToken(user.id, claims);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } });
    setCookies(res, accessToken, newRefreshToken);

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
};

// GET /api/auth/me
export const getMe = async (req, res) => {
    const { refreshToken: _, otpCode: __, otpExpiresAt: ___, otpAttempts: ____, ...safeUser } = req.user;
    res.json({ success: true, user: safeUser });
};
