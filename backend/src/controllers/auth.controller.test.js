import { describe, it, expect, beforeEach, vi } from 'vitest';
import { register, login, logout } from './auth.controller.js';
import { prisma } from '../utils/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

vi.mock('../utils/prisma.js', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(),
        compare: vi.fn(),
    }
}));

vi.mock('jsonwebtoken', () => ({
    default: {
        sign: vi.fn(),
        verify: vi.fn(),
    }
}));

describe('Auth Controller Tests', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReq = {
            body: {},
            cookies: {},
            user: null,
        };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
        };
        process.env.JWT_SECRET = 'test_secret';
        process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    });

    describe('register', () => {
        it('should successfully register a new user', async () => {
            mockReq.body = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
            };

            prisma.user.findUnique.mockResolvedValue(null);
            bcrypt.hash.mockResolvedValue('hashed_password');
            
            const mockUser = {
                id: 'user_123',
                name: 'Test User',
                email: 'test@example.com',
                passwordHash: 'hashed_password',
            };
            prisma.user.create.mockResolvedValue(mockUser);
            prisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: 'refresh_token_123' });
            
            jwt.sign.mockImplementation((payload, secret) => {
                if (secret === 'test_secret') return 'access_token_123';
                return 'refresh_token_123';
            });

            await register(mockReq, mockRes);

            expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
            expect(prisma.user.create).toHaveBeenCalledWith({
                data: { name: 'Test User', email: 'test@example.com', passwordHash: 'hashed_password' },
            });
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                user: { id: 'user_123', name: 'Test User', email: 'test@example.com' },
                accessToken: 'access_token_123',
            });
        });

        it('should throw an error if the email is already in use', async () => {
            mockReq.body = {
                name: 'Test User',
                email: 'existing@example.com',
                password: 'password123',
            };

            prisma.user.findUnique.mockResolvedValue({ id: 'existing_user_id' });

            await expect(register(mockReq, mockRes)).rejects.toThrow(AppError);
            await expect(register(mockReq, mockRes)).rejects.toThrow('Email already in use.');
        });
    });

    describe('login', () => {
        it('should successfully log in a user with valid credentials', async () => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'password123',
            };

            const mockUser = {
                id: 'user_123',
                name: 'Test User',
                email: 'test@example.com',
                passwordHash: 'hashed_password',
            };

            prisma.user.findFirst.mockResolvedValue(mockUser);
            bcrypt.compare.mockResolvedValue(true);
            prisma.user.update.mockResolvedValue({ ...mockUser, refreshToken: 'refresh_token_123' });
            
            jwt.sign.mockImplementation((payload, secret) => {
                if (secret === 'test_secret') return 'access_token_123';
                return 'refresh_token_123';
            });

            await login(mockReq, mockRes);

            expect(prisma.user.findFirst).toHaveBeenCalled();
            expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                user: { id: 'user_123', name: 'Test User', email: 'test@example.com' },
                accessToken: 'access_token_123',
            });
        });

        it('should throw an error for invalid credentials', async () => {
            mockReq.body = {
                email: 'test@example.com',
                password: 'wrongpassword',
            };

            prisma.user.findFirst.mockResolvedValue(null);

            await expect(login(mockReq, mockRes)).rejects.toThrow(AppError);
            await expect(login(mockReq, mockRes)).rejects.toThrow('Invalid credentials.');
        });
    });

    describe('logout', () => {
        it('should successfully log out a user', async () => {
            mockReq.user = { id: 'user_123' };
            prisma.user.update.mockResolvedValue({ id: 'user_123', refreshToken: null });

            await logout(mockReq, mockRes);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user_123' },
                data: { refreshToken: null },
            });
            // Cleared with the same attributes they were set with, otherwise
            // the browser keeps the cookies.
            expect(mockRes.clearCookie).toHaveBeenCalledWith(
                'access_token',
                expect.objectContaining({ httpOnly: true, path: '/' }),
            );
            expect(mockRes.clearCookie).toHaveBeenCalledWith(
                'refresh_token',
                expect.objectContaining({ httpOnly: true, path: '/' }),
            );
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Logged out successfully.',
            });
        });
    });
});
