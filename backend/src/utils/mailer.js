import nodemailer from 'nodemailer';

const DEFAULT_FROM = 'PickAndSync <noreply@pickandsync.com>';
const SEND_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 12000);

export function smtpConfigured() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return Boolean(host && user && pass && !String(pass).includes('your_zeptomail'));
}

export function getEmailFrom() {
    return process.env.EMAIL_FROM || DEFAULT_FROM;
}

function parseFrom(from) {
    const match = String(from).match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
        return { name: match[1].trim() || 'PickAndSync', address: match[2].trim() };
    }
    return { name: 'PickAndSync', address: from };
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
        connectionTimeout: SEND_TIMEOUT_MS,
        greetingTimeout: SEND_TIMEOUT_MS,
        socketTimeout: SEND_TIMEOUT_MS,
    });
}

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
    ]);
}

/**
 * ZeptoMail HTTP API — preferred on hosts (e.g. Render) that block outbound SMTP.
 * Uses SMTP_PASS / ZEPTOMAIL_TOKEN as the send-mail token.
 */
async function sendViaZeptoMailHttp({ to, subject, html, text }) {
    const token = process.env.ZEPTOMAIL_TOKEN || process.env.SMTP_PASS;
    if (!token || String(token).includes('your_zeptomail')) {
        throw new Error('ZeptoMail token not configured');
    }

    const from = parseFrom(getEmailFrom());
    const endpoint = process.env.ZEPTOMAIL_API_URL || 'https://api.zeptomail.in/v1.1/email';

    const res = await withTimeout(
        fetch(endpoint, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Zoho-enczapikey ${token}`,
            },
            body: JSON.stringify({
                from: { address: from.address, name: from.name },
                to: [{ email_address: { address: to, name: to } }],
                subject,
                htmlbody: html,
                textbody: text || undefined,
            }),
        }),
        SEND_TIMEOUT_MS,
        'ZeptoMail HTTP',
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.message || data?.error?.message || `ZeptoMail HTTP ${res.status}`;
        throw new Error(msg);
    }
    return true;
}

async function sendViaSmtp({ to, subject, html, text }) {
    if (!smtpConfigured()) {
        throw new Error('SMTP not configured');
    }

    const transporter = createTransport();
    try {
        await withTimeout(
            transporter.sendMail({
                from: getEmailFrom(),
                to,
                subject,
                html,
                text,
            }),
            SEND_TIMEOUT_MS,
            'SMTP',
        );
        return true;
    } finally {
        transporter.close();
    }
}

/**
 * Send an email via ZeptoMail HTTP (preferred) or SMTP fallback.
 * @returns {Promise<boolean>} true if sent
 */
export async function sendMail({ to, subject, html, text }) {
    if (!smtpConfigured() && !(process.env.ZEPTOMAIL_TOKEN || process.env.SMTP_PASS)) {
        return false;
    }

    // Prefer HTTPS API — Render and many PaaS block SMTP ports 465/587.
    if (process.env.SMTP_HTTP_ONLY !== 'true') {
        try {
            await sendViaZeptoMailHttp({ to, subject, html, text });
            return true;
        } catch (err) {
            console.error('[ZeptoMail HTTP]', err.message || err);
            if (process.env.SMTP_HTTP_ONLY === '1' || process.env.DISABLE_SMTP === 'true') {
                throw err;
            }
        }
    }

    try {
        await sendViaSmtp({ to, subject, html, text });
        return true;
    } catch (err) {
        console.error('[SMTP]', err.message || err);
        throw err;
    }
}
