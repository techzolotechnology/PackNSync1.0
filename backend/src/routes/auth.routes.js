import { Router } from 'express';
import { requestOtp, verifyOtp, logout, refreshAccessToken, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/request-otp', requestOtp);
authRouter.post('/verify-otp', verifyOtp);
authRouter.post('/logout', authenticate, logout);
authRouter.post('/refresh', refreshAccessToken);
authRouter.get('/me', authenticate, getMe);
