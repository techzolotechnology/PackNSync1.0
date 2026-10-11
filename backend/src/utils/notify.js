import { prisma } from './prisma.js';
import { pushToUser } from './push.js';

/**
 * Persist an in-app notification and push it to the user's devices
 * (best-effort — never throws to callers).
 */
export async function notifyUser({ userId, type, title, body, data = null }) {
    if (!userId) return null;
    let notification = null;
    try {
        notification = await prisma.notification.create({
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
    }
    // Push after persisting so the in-app list and the device alert carry the same content.
    await pushToUser(userId, { title, body, data: { type, ...(data || {}) } });
    return notification;
}
