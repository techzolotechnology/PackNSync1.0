import { AppError } from './AppError.js';
import { emailConfigured, sendMail } from './mailer.js';
import { otpEmail } from './emailTemplates.js';

/** Normalize contact for DB lookup/storage */
export function normalizeContact(contact) {
    const trimmed = contact.trim();
    const value = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new AppError('Enter a valid email address.', 400);
    }
    return { isEmail: true, value };
}

function logDevOtp(label, contact, otpCode) {
    console.log('');
    console.log('========================================');
    console.log(`[DEV OTP] ${label}: ${contact}`);
    console.log(`[DEV OTP] Code: ${otpCode}`);
    console.log('========================================');
    console.log('');
}

async function sendEmailOtp(email, otpCode) {
    const blockedDomain = /\@(example\.com|test\.com|localhost|packandsync\.local)$/i.test(email);
    const allowConsoleFallback =
        process.env.NODE_ENV !== 'production' && process.env.OTP_CONSOLE_FALLBACK === 'true';

    if (blockedDomain) {
        if (process.env.NODE_ENV === 'production') {
            throw new AppError('Please use a real email address to receive the OTP.', 400);
        }
        logDevOtp('Email', email, otpCode);
        return 'console';
    }

    if (!emailConfigured()) {
        if (process.env.NODE_ENV === 'production') {
            throw new AppError(
                'Email OTP delivery is not configured. Please add the mail provider settings and try again.',
                502,
            );
        }
        logDevOtp('Email', email, otpCode);
        return 'console';
    }

    if (allowConsoleFallback) {
        logDevOtp('Email', email, otpCode);
        return 'console';
    }

    const { html, text } = otpEmail({ otpCode, minutes: 10 });

    try {
        await sendMail({
            to: email,
            subject: 'Your PickAndSync verification code',
            html,
            text,
        });
        return 'email';
    } catch (err) {
        console.error('[Email] delivery failed:', err.message || err);
        if (process.env.NODE_ENV === 'production') {
            throw new AppError(
                'Could not send the OTP email right now. Please try again in a moment.',
                502,
            );
        }
        logDevOtp('Email (delivery failed)', email, otpCode);
        return 'console';
    }
}

export async function deliverOtp({ contact, otpCode }) {
    return sendEmailOtp(contact, otpCode);
}
