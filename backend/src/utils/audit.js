import { prisma } from './prisma.js';
import { requestContext, sendAdminAlert } from './adminAlerts.js';

/** Actions that also email the alert recipients (money movement, access changes). */
const ALERT_ACTIONS = new Set([
    'USER_ROLE',
    'USER_DELETE',
    'PAYMENT_REFUND',
    'WITHDRAWAL_COMPLETE',
    'WITHDRAWAL_REJECT',
    'PROMO_GRANT',
    'EARNING_RELEASE',
    'MFA_RESET',
    'BROADCAST_SEND',
    'OFFER_SEND',
    'OFFER_END',
]);

/**
 * Record an admin action. Best-effort: an audit failure is logged but never
 * blocks the action itself.
 */
export async function logAdminAction(req, { action, targetType, targetId = null, summary, metadata }) {
    try {
        await prisma.adminAuditLog.create({
            data: {
                adminId: req.user?.id || null,
                action,
                targetType,
                targetId: targetId ? String(targetId) : null,
                summary: String(summary).slice(0, 500),
                ...(metadata ? { metadata } : {}),
            },
        });
    } catch (err) {
        console.error('[audit] failed to record', action, err.message || err);
    }

    if (ALERT_ACTIONS.has(action)) {
        const ctx = requestContext(req);
        sendAdminAlert({
            subject: summary.slice(0, 120),
            intro: `Admin action: ${action}`,
            details: [['Admin', ctx.admin], ['IP', ctx.ip], ['Target', `${targetType} ${targetId || ''}`.trim()]],
        });
    }
}
