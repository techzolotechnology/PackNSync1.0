import { Router } from 'express';
import {
    submitVerification,
    getVerificationStatus,
    acceptPolicy,
    connectDigiLocker,
    syncCashfreeDigiLockerStatus,
    verifyDrivingLicenseWithCashfree,
    submitRcViaDigiLocker,
    getPolicyStatus,
    uploadRcForOcr,
} from '../controllers/verification.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { rcUpload } from '../middleware/rcUpload.middleware.js';
import { verificationUpload } from '../middleware/verificationUpload.middleware.js';

export const verificationRouter = Router();

verificationRouter.post('/submit', authenticate, verificationUpload.single('document'), submitVerification);
verificationRouter.post('/digilocker/connect', authenticate, connectDigiLocker);
verificationRouter.post('/cashfree/digilocker/status', authenticate, syncCashfreeDigiLockerStatus);
verificationRouter.post('/cashfree/driving-license', authenticate, verifyDrivingLicenseWithCashfree);
verificationRouter.post('/digilocker/rc', authenticate, submitRcViaDigiLocker);
verificationRouter.post('/rc/upload', authenticate, rcUpload.single('rcImage'), uploadRcForOcr);
verificationRouter.get('/status', authenticate, getVerificationStatus);
verificationRouter.get('/policies/status', authenticate, getPolicyStatus);
verificationRouter.post('/policies/accept', authenticate, acceptPolicy);
