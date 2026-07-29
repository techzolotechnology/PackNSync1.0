import { prisma } from './prisma.js';

/**
 * Persist an in-app notification (best-effort — never throws to callers).
 */
export async function notifyUser({ userId, type, title, body, data = null }) {
    if (!userId) return null;
    try {
        return await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                body,
                data: data || undefined,
            },
        });
    } catch (err) {
        console.error('[notifyUser]', err.message);
        return null;
    }
}
