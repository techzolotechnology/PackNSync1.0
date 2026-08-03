import { AppError } from './AppError.js';
import { sendMail, smtpConfigured } from './mailer.js';
import { otpEmail } from './emailTemplates.js';

/** Normalize contact for DB lookup/storage */
export function normalizeContact(contact) {
    const trimmed = contact.trim();
    if (trimmed.includes('@')) {
        return { isEmail: true, value: trimmed.toLowerCase() };
    }
    const digits = trimmed.replace(/\D/g, '');
    const value = digits.length >= 10 ? digits.slice(-10) : digits;
    return { isEmail: false, value };
}

function toE164(phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    if (phoneNumber.trim().startsWith('+')) return phoneNumber.trim();
    return `+${digits}`;
}

function toMsg91Mobile(phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    const local = digits.length >= 10 ? digits.slice(-10) : digits;
    return `91${local}`;
}

function twilioConfigured() {
    return Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    );
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

    if (!smtpConfigured() || blockedDomain || process.env.OTP_CONSOLE_FALLBACK === 'true') {
        logDevOtp('Email', email, otpCode);
        return 'console';
    }

    const { html, text } = otpEmail({ otpCode, minutes: 10 });

    try {
        await sendMail({
            to: email,
            subject: 'Your PackAndSync verification code',
            html,
            text,
        });
        return 'email';
    } catch (err) {
        console.error('[Email] delivery failed:', err.message || err);
        if (process.env.NODE_ENV === 'production' && process.env.OTP_CONSOLE_FALLBACK !== 'true') {
            throw new AppError(
                'Could not send the OTP email right now. Please try again in a moment.',
                502,
            );
        }
        logDevOtp('Email (delivery failed)', email, otpCode);
        return 'console';
    }
}

async function sendTwilioSms(phoneNumber, otpCode) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    const to = toE164(phoneNumber);

    const body = new URLSearchParams({
        To: to,
        From: from,
        Body: `Your PackAndSync verification code is ${otpCode}. Valid for 10 minutes.`,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });

    const data = await res.json();
    if (!res.ok) {
        console.error('[Twilio]', data);
        const hint = data.code === 21608
            ? ' Verify your phone number in Twilio Console → Verified Caller IDs (trial accounts).'
            : '';
        throw new AppError((data.message || 'Failed to send SMS OTP.') + hint, 502);
    }

    return 'sms';
}

async function sendMsg91Sms(phoneNumber, otpCode) {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    if (!authKey || authKey.includes('your_msg91')) return null;

    const mobile = toMsg91Mobile(phoneNumber);
    const payload = { mobile, otp: otpCode };
    if (templateId) payload.template_id = templateId;

    const res = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            authkey: authKey,
        },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.type === 'error') {
        console.error('[MSG91]', data);
        throw new AppError(data.message || 'Failed to send SMS OTP.', 502);
    }

    return 'sms';
}

async function sendSmsOtp(phoneNumber, otpCode) {
    if (twilioConfigured()) {
        return sendTwilioSms(phoneNumber, otpCode);
    }

    const msg91Result = await sendMsg91Sms(phoneNumber, otpCode);
    if (msg91Result) return msg91Result;

    logDevOtp('SMS', phoneNumber, otpCode);
    return 'console';
}

export async function deliverOtp({ contact, otpCode, isEmail }) {
    if (isEmail) {
        return sendEmailOtp(contact, otpCode);
    }
    return sendSmsOtp(contact, otpCode);
}
