import rateLimit from 'express-rate-limit';

const limitMessage = (message) => ({ success: false, message });

/** OTP request/verify: tight per-IP cap on top of the per-account attempt limit. */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage('Too many sign-in attempts. Please try again in a few minutes.'),
});

/**
 * Endpoints that call paid third-party APIs (OpenAI, Google Places).
 * Keyed by user when signed in, otherwise by IP.
 */
export const paidApiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`),
    message: limitMessage('Explore limit reached. Please try again later.'),
});
