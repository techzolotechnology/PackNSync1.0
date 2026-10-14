import rateLimit from 'express-rate-limit';
export const inspectionWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => `inspection:${req.user.id}`,
  message: { success: false, message: 'Too many inspection changes. Try again later.' },
});
