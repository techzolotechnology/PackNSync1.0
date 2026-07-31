import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { signAccessToken, signRefreshToken, setCookies, clearCookies } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { normalizeContact, deliverOtp } from '../utils/otpDelivery.js';

// POST /api/auth/request-otp
export const requestOtp = async (req, res) => {
    const { contact, name, isRegister } = req.body;
    if (!contact) throw new AppError('Email or phone number is required.', 400);

    const { isEmail, value } = normalizeContact(contact);
    const query = isEmail ? { email: value } : { phoneNumber: value };

    let user = await prisma.user.findUnique({ where: query });

    if (isRegister && user) {
        throw new AppError('Account already exists. Please log in.', 409);
    }
    if (!isRegister && !user) {
        throw new AppError('Account not found. Please register.', 404);
    }
    if (isRegister && !name?.trim()) {
        throw new AppError('Name is required for registration.', 400);
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60000);

    if (isRegister) {
        const data = isEmail ? { email: value } : { phoneNumber: value };
        user = await prisma.user.create({
            data: { ...data, name: name.trim(), otpCode, otpExpiresAt },
        });
    } else {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { otpCode, otpExpiresAt },
        });
    }

    const channel = await deliverOtp({ contact: value, otpCode, isEmail });

    res.json({
        success: true,
        channel,
        message: channel === 'console'
            ? 'OTP printed in the backend terminal (email/SMS provider cannot deliver to this address).'
            : `OTP sent to your ${isEmail ? 'email' : 'phone'}.`,
    });
};

// POST /api/auth/verify-otp
export const verifyOtp = async (req, res) => {
    const { contact, otpCode } = req.body;
    if (!contact || !otpCode) throw new AppError('Contact and OTP are required.', 400);

    const { isEmail, value } = normalizeContact(contact);
    const query = isEmail ? { email: value } : { phoneNumber: value };

    const user = await prisma.user.findUnique({ where: query });
    if (!user) throw new AppError('Invalid request.', 401);
    if (user.isBanned) {
        throw new AppError(
            user.banReason ? `Account suspended: ${user.banReason}` : 'Your account has been suspended.',
            403
        );
    }

    if (user.otpCode !== otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
        throw new AppError('Invalid or expired OTP.', 401);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpiresAt: null },
    });

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });
    setCookies(res, accessToken, refreshToken);

    const { refreshToken: _, otpCode: __, otpExpiresAt: ___, ...safeUser } = user;
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

    const accessToken = signAccessToken(user.id);
    const newRefreshToken = signRefreshToken(user.id);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } });
    setCookies(res, accessToken, newRefreshToken);

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
};

// GET /api/auth/me
export const getMe = async (req, res) => {
    const { refreshToken: _, otpCode: __, otpExpiresAt: ___, ...safeUser } = req.user;
    res.json({ success: true, user: safeUser });
};
