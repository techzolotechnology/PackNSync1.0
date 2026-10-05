import { AppError } from '../utils/AppError.js';

export const adminMfaRequired = () => process.env.ADMIN_MFA_REQUIRED !== 'false';

/** How long a passed 2FA check lasts before the admin must enter a new code. */
export const adminMfaSessionMs = () => {
    const hours = Number(process.env.ADMIN_MFA_SESSION_HOURS || 12);
    return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600 * 1000;
};

/**
 * Admin routes need a token that passed two-factor recently. Admins without
 * an authenticator get MFA_SETUP_REQUIRED and must enroll first.
 */
export const requireAdminMfa = (req, _res, next) => {
    if (!adminMfaRequired()) return next();
    if (!req.user?.totpEnabled) {
        return next(new AppError('Set up Google Authenticator to use the admin panel.', 403, 'MFA_SETUP_REQUIRED'));
    }
    const mfaAt = Number(req.auth?.mfaAt) || 0;
    if (!mfaAt || Date.now() - mfaAt > adminMfaSessionMs()) {
        return next(new AppError('Enter your authenticator code to continue.', 403, 'MFA_REQUIRED'));
    }
    next();
};
