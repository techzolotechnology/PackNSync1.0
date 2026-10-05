import { Router } from 'express';
import { requestOtp, verifyOtp, logout, refreshAccessToken, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

export const authRouter = Router();

authRouter.post('/request-otp', authLimiter, requestOtp);
authRouter.post('/verify-otp', authLimiter, verifyOtp);
authRouter.post('/logout', authenticate, logout);
authRouter.post('/refresh', refreshAccessToken);
authRouter.get('/me', authenticate, getMe);
