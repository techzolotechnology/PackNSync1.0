import { emailConfigured, sendMail } from './mailer.js';
import { wrapEmail } from './emailTemplates.js';

/** Who receives security/money alerts. Comma-separated; override with ADMIN_ALERT_EMAILS. */
export function alertRecipients() {
    return String(process.env.ADMIN_ALERT_EMAILS || 'Kartikgauttam@techzolo.in')
        .split(',')
        .map((e) => e.trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

const escape = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Who/where an admin action came from, for alert emails. */
export function requestContext(req) {
    return {
        admin: req?.user ? `${req.user.name} <${req.user.email || req.user.phoneNumber || req.user.id}>` : 'unknown',
        ip: req?.ip || 'unknown',
        device: String(req?.get?.('user-agent') || 'unknown').slice(0, 160),
    };
}

/**
 * Email the alert recipients. Best-effort and non-blocking: an alert failure
 * is logged and never fails the action that triggered it.
 *
 * details: [[label, value], …]
 */
export function sendAdminAlert({ subject, intro, details = [] }) {
    const to = alertRecipients();
    if (!to.length) return;
    const fullSubject = `[PickAndSync admin] ${subject}`;
    const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const rows = [['When (IST)', when], ...details];

    if (!emailConfigured()) {
        console.log(`[admin alert] ${fullSubject}\n${rows.map(([k, v]) => `  ${k}: ${v}`).join('\n')}`);
        return;
    }

    const { html, text } = wrapEmail({
        preheader: subject,
        title: subject,
        bodyHtml: `<p>${escape(intro)}</p><table cellpadding="6" style="border-collapse:collapse;font-size:14px">${rows
            .map(([k, v]) => `<tr><td style="color:#5c5c99;vertical-align:top">${escape(k)}</td><td><strong>${escape(v)}</strong></td></tr>`)
            .join('')}</table><p style="font-size:13px;color:#5c5c99">If this wasn't expected, open the admin panel's audit log and reset the admin's two-factor access.</p>`,
        bodyText: `${intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`,
        ctaLabel: 'Open admin panel',
        ctaUrl: `${(process.env.FRONTEND_URL || 'https://pickandsync.com').replace(/\/$/, '')}/admin?tab=Audit`,
    });

    Promise.all(to.map((address) => sendMail({ to: address, subject: fullSubject, html, text })))
        .catch((err) => console.error('[admin alert] email failed:', err.message || err));
}
