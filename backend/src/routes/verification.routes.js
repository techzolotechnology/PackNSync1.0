import { Router } from 'express';
import {
    submitVerification,
    getVerificationStatus,
    acceptPolicy,
    connectDigiLocker,
    submitRcViaDigiLocker,
    getPolicyStatus,
    uploadRcForOcr,
} from '../controllers/verification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { rcUpload } from '../middleware/rcUpload.middleware.js';

export const verificationRouter = Router();

verificationRouter.post('/submit', authenticate, submitVerification);
verificationRouter.post('/digilocker/connect', authenticate, connectDigiLocker);
verificationRouter.post('/digilocker/rc', authenticate, submitRcViaDigiLocker);
verificationRouter.post('/rc/upload', authenticate, rcUpload.single('rcImage'), uploadRcForOcr);
verificationRouter.get('/status', authenticate, getVerificationStatus);
verificationRouter.get('/policies/status', authenticate, getPolicyStatus);
verificationRouter.post('/policies/accept', authenticate, acceptPolicy);
