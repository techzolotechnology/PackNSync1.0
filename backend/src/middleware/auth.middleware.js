import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';

export const authenticate = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.access_token) {
        token = req.cookies.access_token;
    }

    if (!token) {
        const err = new Error('Not authenticated. Please log in.');
        err.statusCode = 401;
        return next(err);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.sub } });

        if (!user) {
            const err = new Error('User no longer exists.');
            err.statusCode = 401;
            return next(err);
        }

        if (user.isBanned) {
            const err = new Error(user.banReason
                ? `Account suspended: ${user.banReason}`
                : 'Your account has been suspended. Contact support.');
            err.statusCode = 403;
            return next(err);
        }

        req.user = user;
        next();
    } catch {
        const err = new Error('Invalid or expired token.');
        err.statusCode = 401;
        next(err);
    }
};

export const optionalAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.access_token) {
        token = req.cookies.access_token;
    }

    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
        if (user) req.user = user;
    } catch {
        // ignore invalid token for optional auth
    }
    next();
};

export const authorize = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
        const err = new Error('You do not have permission to perform this action.');
        err.statusCode = 403;
        return next(err);
    }
    next();
};
