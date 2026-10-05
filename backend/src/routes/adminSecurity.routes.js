import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { signAccessToken, signRefreshToken, setCookies } from '../utils/jwt.js';
import {
    consumeBackupCode, generateBackupCodes, generateTotpSecret, otpauthUrl, verifyTotp,
} from '../utils/totp.js';
import { open, seal } from '../utils/secretBox.js';
import { requestContext, sendAdminAlert } from '../utils/adminAlerts.js';
import { logAdminAction } from '../utils/audit.js';
import { adminMfaRequired, adminMfaSessionMs } from '../middleware/adminMfa.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

/**
 * Admin two-factor (Google Authenticator). Mounted before the MFA gate, so an
 * admin can enroll and verify. Everything else under /api/admin needs a
 * verified session.
 */
export const adminSecurityRouter = Router();

/** Consecutive wrong codes per admin (in memory; resets on restart). */
const failedAttempts = new Map();

function issueMfaSession(res, userId) {
    const claims = { mfaAt: Date.now() };
    const accessToken = signAccessToken(userId, claims);
    const refreshToken = signRefreshToken(userId, claims);
    setCookies(res, accessToken, refreshToken);
    return { accessToken, refreshToken };
}

const mfaVerified = (req) => {
    const mfaAt = Number(req.auth?.mfaAt) || 0;
    return Boolean(mfaAt && Date.now() - mfaAt <= adminMfaSessionMs());
};

// GET /api/admin/2fa/status
adminSecurityRouter.get('/status', (req, res) => {
    res.json({
        success: true,
        data: {
            required: adminMfaRequired(),
            enabled: Boolean(req.user.totpEnabled),
            verified: mfaVerified(req),
            backupCodesLeft: (req.user.totpBackupCodes || []).length,
        },
    });
});

// POST /api/admin/2fa/setup — new secret to scan; not active until /enable
adminSecurityRouter.post('/setup', async (req, res) => {
    if (req.user.totpEnabled) throw new AppError('Two-factor is already on. Disable it first to re-enroll.', 400);
    const secret = generateTotpSecret();
    await prisma.user.update({ where: { id: req.user.id }, data: { totpSecret: seal(secret), totpLastStep: null } });
    res.json({
        success: true,
        data: { secret, otpauthUrl: otpauthUrl(secret, req.user.email || req.user.name) },
    });
});

// POST /api/admin/2fa/enable { code } — confirm the app works, then switch 2FA on
adminSecurityRouter.post('/enable', authLimiter, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user.totpEnabled) throw new AppError('Two-factor is already on.', 400);
    if (!user.totpSecret) throw new AppError('Start setup first.', 400);

    const step = verifyTotp(open(user.totpSecret), req.body?.code);
    if (step === null) throw new AppError('That code did not match. Check the time on your phone and try the newest code.', 400);

    const { codes, hashes } = generateBackupCodes();
    const session = issueMfaSession(res, user.id);
    await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true, totpLastStep: step, totpBackupCodes: hashes, refreshToken: session.refreshToken },
    });

    await logAdminAction(req, { action: 'MFA_ENABLE', targetType: 'USER', targetId: user.id, summary: `${user.name} turned on two-factor` });
    const ctx = requestContext(req);
    sendAdminAlert({
        subject: `Two-factor enabled for ${user.name}`,
        intro: 'An admin set up Google Authenticator for their account.',
        details: [['Admin', ctx.admin], ['IP', ctx.ip], ['Device', ctx.device]],
    });

    res.json({
        success: true,
        data: { backupCodes: codes, accessToken: session.accessToken, refreshToken: session.refreshToken },
    });
});

// POST /api/admin/2fa/verify { code } — start a 2FA session (code or backup code)
adminSecurityRouter.post('/verify', authLimiter, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.totpEnabled || !user.totpSecret) {
        throw new AppError('Set up Google Authenticator first.', 400, 'MFA_SETUP_REQUIRED');
    }

    const code = String(req.body?.code || '').trim();
    const ctx = requestContext(req);
    let usedBackup = false;
    const update = {};

    const step = verifyTotp(open(user.totpSecret), code, { lastStep: user.totpLastStep });
    if (step !== null) {
        update.totpLastStep = step;
    } else {
        const remaining = consumeBackupCode(user.totpBackupCodes, code);
        if (!remaining) {
            const fails = (failedAttempts.get(user.id) || 0) + 1;
            failedAttempts.set(user.id, fails);
            if (fails % 5 === 0) {
                sendAdminAlert({
                    subject: `${fails} wrong authenticator codes for ${user.name}`,
                    intro: 'Someone keeps entering wrong two-factor codes on an admin account. If this was not the admin, their email may be compromised.',
                    details: [['Admin', ctx.admin], ['IP', ctx.ip], ['Device', ctx.device]],
                });
            }
            throw new AppError('Wrong or already-used code.', 401, 'MFA_INVALID');
        }
        usedBackup = true;
        update.totpBackupCodes = remaining;
    }
    failedAttempts.delete(user.id);

    const session = issueMfaSession(res, user.id);
    await prisma.user.update({ where: { id: user.id }, data: { ...update, refreshToken: session.refreshToken } });

    sendAdminAlert({
        subject: `Admin sign-in: ${user.name}`,
        intro: usedBackup
            ? 'An admin signed in to the admin panel using a BACKUP code. If they lost their phone, reset their two-factor.'
            : 'An admin signed in to the admin panel.',
        details: [['Admin', ctx.admin], ['IP', ctx.ip], ['Device', ctx.device], ['Method', usedBackup ? 'Backup code' : 'Authenticator app']],
    });

    res.json({
        success: true,
        data: {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            usedBackupCode: usedBackup,
            backupCodesLeft: usedBackup ? update.totpBackupCodes.length : (user.totpBackupCodes || []).length,
        },
    });
});

// POST /api/admin/2fa/backup-codes { code } — replace backup codes (needs a fresh app code)
adminSecurityRouter.post('/backup-codes', authLimiter, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.totpEnabled) throw new AppError('Two-factor is not on.', 400);
    const step = verifyTotp(open(user.totpSecret), req.body?.code, { lastStep: user.totpLastStep });
    if (step === null) throw new AppError('Wrong or already-used code.', 401, 'MFA_INVALID');

    const { codes, hashes } = generateBackupCodes();
    await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: hashes, totpLastStep: step } });
    await logAdminAction(req, { action: 'MFA_BACKUP_CODES', targetType: 'USER', targetId: user.id, summary: `${user.name} generated new backup codes` });
    res.json({ success: true, data: { backupCodes: codes } });
});

// POST /api/admin/2fa/disable { code } — turn off (needs a fresh app code)
adminSecurityRouter.post('/disable', authLimiter, async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.totpEnabled) throw new AppError('Two-factor is not on.', 400);
    if (verifyTotp(open(user.totpSecret), req.body?.code, { lastStep: user.totpLastStep }) === null) {
        throw new AppError('Wrong or already-used code.', 401, 'MFA_INVALID');
    }
    await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [], totpLastStep: null },
    });
    await logAdminAction(req, { action: 'MFA_DISABLE', targetType: 'USER', targetId: user.id, summary: `${user.name} turned off two-factor` });
    const ctx = requestContext(req);
    sendAdminAlert({
        subject: `Two-factor DISABLED for ${user.name}`,
        intro: adminMfaRequired()
            ? 'An admin turned off two-factor. They must set it up again before using the admin panel.'
            : 'An admin turned off two-factor.',
        details: [['Admin', ctx.admin], ['IP', ctx.ip], ['Device', ctx.device]],
    });
    res.json({ success: true });
});

