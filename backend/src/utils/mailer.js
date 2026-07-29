import nodemailer from 'nodemailer';

const DEFAULT_FROM = 'PackAndSync <noreply@pickandsync.com>';

export function smtpConfigured() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return Boolean(host && user && pass && !String(pass).includes('your_zeptomail'));
}

export function getEmailFrom() {
    return process.env.EMAIL_FROM || DEFAULT_FROM;
}

function createTransport() {
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = port === 465;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

/**
 * Send an email via ZeptoMail SMTP (or any SMTP_* config).
 * @returns {Promise<boolean>} true if sent
 */
export async function sendMail({ to, subject, html, text }) {
    if (!smtpConfigured()) {
        return false;
    }

    const transporter = createTransport();
    await transporter.sendMail({
        from: getEmailFrom(),
        to,
        subject,
        html,
        text,
    });
    return true;
}
