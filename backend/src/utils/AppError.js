export class AppError extends Error {
    /** code: optional machine-readable reason the client can branch on (e.g. MFA_REQUIRED). */
    constructor(message, statusCode = 500, code = undefined) {
        super(message);
        this.statusCode = statusCode;
        if (code) this.errorCode = code;
        this.name = 'AppError';
        // Messages written for AppError are safe to show users, even on 5xx.
        this.expose = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const createError = (message, statusCode) => new AppError(message, statusCode);
