import nodemailer from 'nodemailer';

const DEFAULT_FROM = 'PickAndSync <noreply@pickandsync.com>';
const SEND_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 12000);

export function smtpConfigured() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return Boolean(host && user && pass && !String(pass).includes('your_zeptomail'));
}

export function zeptoMailApiConfigured() {
    return zeptoMailTokenCandidates().length > 0;
}

export function emailConfigured() {
    return zeptoMailApiConfigured() || smtpConfigured();
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

function normalizeZeptoMailToken(value) {
    return String(value || '')
        .trim()
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/^Authorization:\s*/i, '')
        .replace(/^Zoho-enczapikey\s*:?\s*/i, '')
        .replace(/^=+/, '')
        .replace(/^['"`]+|['"`]+$/g, '')
        .trim();
}

function zeptoMailTokenCandidates() {
    return [
        ['ZEPTOMAIL_SEND_TOKEN', process.env.ZEPTOMAIL_SEND_TOKEN],
        ['ZEPTOMAIL_TOKEN', process.env.ZEPTOMAIL_TOKEN],
        ['ZEPTOMAIL_API', process.env.ZEPTOMAIL_API],
    ]
        .map(([label, value]) => [label, normalizeZeptoMailToken(value)])
        .filter(([, token]) => token && !String(token).includes('your_zeptomail'));
}

function cleanDisplayName(value) {
    return String(value || '')
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeEndpoint(value) {
    const endpoint = String(value || '').trim().replace(/\/+$/, '');
    if (!endpoint) return '';
    return endpoint.endsWith('/v1.1/email') ? endpoint : `${endpoint}/v1.1/email`;
}

function zeptoMailEndpointCandidates() {
    const region = String(process.env.ZEPTOMAIL_REGION || 'in').toLowerCase();
    const hostByRegion = {
        in: 'api.zeptomail.in',
        india: 'api.zeptomail.in',
        us: 'api.zeptomail.com',
        eu: 'api.zeptomail.eu',
        au: 'api.zeptomail.com.au',
    };
    const host = hostByRegion[region] || hostByRegion.in;
    const endpoints = [
        normalizeEndpoint(process.env.ZEPTOMAIL_API_URL),
        `https://${host}/v1.1/email`,
        'https://api.zeptomail.in/v1.1/email',
        'https://api.zeptomail.com/v1.1/email',
    ].filter(Boolean);

    return [...new Set(endpoints)];
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

function providerErrorMessage(data, fallback) {
    if (!data) return fallback;
    if (typeof data === 'string') {
        const text = data.trim();
        if (!text) return fallback;
        if (/^<!doctype html>|^<html[\s>]/i.test(text)) {
            return `${fallback}. ZeptoMail returned an HTML page instead of API JSON. Check ZEPTOMAIL_API_URL and use the API endpoint for your ZeptoMail data center.`;
        }
        return text;
    }
    if (typeof data !== 'object') return fallback;

    const direct =
        data.message
        || data.error?.message
        || data.error
        || data.details
        || data.data?.message;

    if (direct) return typeof direct === 'string' ? direct : JSON.stringify(direct);

    const serialized = JSON.stringify(data);
    return serialized && serialized !== '{}' ? serialized.slice(0, 500) : fallback;
}

/**
 * ZeptoMail HTTP API — preferred on hosts (e.g. Render) that block outbound SMTP.
 * Uses the ZeptoMail Send Mail API token, not the SMTP password.
 */
async function sendViaZeptoMailHttp({ to, subject, html, text }) {
    const tokens = zeptoMailTokenCandidates();
    if (!tokens.length) {
        throw new Error('ZeptoMail token not configured');
    }

    const parsedFrom = parseFrom(getEmailFrom());
    const from = {
        address: parsedFrom.address,
        name: cleanDisplayName(parsedFrom.name) || 'PickAndSync',
    };
    const endpoints = zeptoMailEndpointCandidates();
    const requestId = `pickandsync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const errors = [];

    for (const endpoint of endpoints) {
        for (const [label, token] of tokens) {
            const res = await withTimeout(
                fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        Authorization: `Zoho-enczapikey ${token}`,
                        'User-Agent': 'PickAndSync/1.0',
                        'X-Request-Id': requestId,
                    },
                    body: JSON.stringify({
                        from,
                        to: [{ email_address: { address: to, name: to } }],
                        subject,
                        htmlbody: html,
                        textbody: text || undefined,
                    }),
                }),
                SEND_TIMEOUT_MS,
                'ZeptoMail HTTP',
            );

            const responseText = await res.text().catch(() => '');
            let data = null;
            if (responseText) {
                try {
                    data = JSON.parse(responseText);
                } catch {
                    data = responseText;
                }
            }

            if (res.ok) return true;

            const status = [res.status, res.statusText].filter(Boolean).join(' ');
            const msg = providerErrorMessage(data || responseText, `ZeptoMail HTTP ${status}`);
            errors.push(`${label} @ ${new URL(endpoint).host}: ${msg}`);
        }
    }

    throw new Error(`${errors.join(' | ')} (request id: ${requestId})`);
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

function normalizeEmailProvider() {
    const raw = String(process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase();
    if (!raw || raw === 'auto') {
        return process.env.NODE_ENV === 'production' ? 'zeptomail-api' : 'auto';
    }
    if (raw === 'zeptomail' || raw === 'zeptomail_api' || raw === 'api') return 'zeptomail-api';
    return raw;
}

export function describeEmailConfig() {
    return {
        zeptoMailApi: zeptoMailApiConfigured(),
        smtp: smtpConfigured(),
        provider: normalizeEmailProvider(),
        region: String(process.env.ZEPTOMAIL_REGION || 'in').trim().toLowerCase(),
        from: getEmailFrom(),
    };
}

export async function sendMail({ to, subject, html, text }) {
    const config = describeEmailConfig();
    const smtpAllowed = process.env.DISABLE_SMTP !== 'true';
    const methods = [];

    if (config.provider === 'smtp') {
        if (config.smtp && smtpAllowed) methods.push('smtp');
        if (config.zeptoMailApi) methods.push('zepto');
    } else {
        if (config.zeptoMailApi) methods.push('zepto');
        if (config.smtp && smtpAllowed) methods.push('smtp');
    }

    if (!methods.length) {
        throw new Error(
            `Email provider is not configured (provider=${config.provider}, zeptoMailApi=${config.zeptoMailApi}, smtp=${config.smtp}). Add ZEPTOMAIL_TOKEN or SMTP_PASS in Render.`,
        );
    }

    const errors = [];

    for (const method of methods) {
        try {
            if (method === 'zepto') {
                await sendViaZeptoMailHttp({ to, subject, html, text });
            } else {
                await sendViaSmtp({ to, subject, html, text });
            }
            return true;
        } catch (err) {
            const label = method === 'zepto' ? 'ZeptoMail API' : 'SMTP';
            errors.push(`${label}: ${err.message || err}`);
            console.error(`[${label}]`, err.message || err);
        }
    }

    throw new Error(
        errors.join(' | ')
        || `No email provider could send this message (provider=${config.provider}, zeptoMailApi=${config.zeptoMailApi}, smtp=${config.smtp}, from=${config.from})`,
    );
}
