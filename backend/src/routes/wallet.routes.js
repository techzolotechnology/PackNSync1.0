import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
    getWallet,
    listTransactions,
    createTopup,
    verifyTopup,
    cashfreeWebhook,
    withdraw,
} from '../controllers/wallet.controller.js';

export const walletRouter = Router();

walletRouter.get('/', authenticate, getWallet);
walletRouter.get('/transactions', authenticate, listTransactions);
walletRouter.post('/topup', authenticate, createTopup);
walletRouter.post('/topup/verify', authenticate, verifyTopup);
walletRouter.post('/withdraw', authenticate, withdraw);
walletRouter.post('/webhook/cashfree', cashfreeWebhook);
