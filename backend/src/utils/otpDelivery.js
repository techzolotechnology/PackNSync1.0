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

function emailDeliveryMessage(err) {
    const message = String(err?.message || err || '');
    const safeMessage = message
        .replace(/Zoho-enczapikey\s+[A-Za-z0-9._-]+/gi, 'Zoho-enczapikey [hidden]')
        .replace(/(password|token|secret|key)=([^&\s]+)/gi, '$1=[hidden]')
        .slice(0, 220);

    if (/not configured|missing|required/i.test(message)) {
        return 'Email provider is not configured. Please add ZEPTOMAIL_TOKEN or SMTP settings in Render.';
    }

    if (/verified|not authorized|sender|from address|from_address|domain|mail agent|bounce address/i.test(message)) {
        return 'Email sender is not verified in ZeptoMail. Please verify EMAIL_FROM/domain in ZeptoMail and try again.';
    }

    if (/ZeptoMail API:.*(invalid.*token|access denied|unauthorized|401|403)|TM_4001|SERR_157/i.test(message)) {
        return 'ZeptoMail API token is invalid. In Render, replace ZEPTOMAIL_TOKEN with a Send Mail API token from ZeptoMail, then redeploy.';
    }

    if (/SMTP:.*(535|authentication|auth|credential|login|username|password)|Invalid login/i.test(message)) {
        return 'ZeptoMail SMTP login is invalid. In Render, check SMTP_USER=emailapikey and replace SMTP_PASS with the ZeptoMail SMTP password.';
    }

    if (/invalid.*token|unauthorized|authentication|auth|535|credential|login|access denied|401|403/i.test(message)) {
        return 'Email provider credentials are invalid. Check whether Render is using ZEPTOMAIL_TOKEN or SMTP_PASS, then replace that secret.';
    }

    if (/timeout|timed out|econn|enotfound|esocket|network|connect/i.test(message)) {
        return 'Could not connect to the email provider from Render. Use ZeptoMail API token delivery instead of SMTP.';
    }

    return `Email provider rejected the OTP email: ${safeMessage || 'unknown provider error'}`;
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
            throw new AppError(emailDeliveryMessage(err), 502);
        }
        logDevOtp('Email (delivery failed)', email, otpCode);
        return 'console';
    }
}

export async function deliverOtp({ contact, otpCode }) {
    return sendEmailOtp(contact, otpCode);
}
