import { prisma } from './prisma.js';

// Expo's push service. No credentials needed for Expo-managed apps; Expo relays to FCM/APNs.
const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';
const isExpoToken = (t) => typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t.trim());

/**
 * Send one notification to a set of Expo push tokens. Best-effort: never throws.
 * Returns the tokens Expo reports as dead (unregistered / invalid) so callers can prune them.
 */
export async function sendExpoPush(tokens, { title, body, data }) {
  const valid = [...new Set((tokens || []).filter(isExpoToken))];
  if (valid.length === 0) return { dead: [] };

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
    channelId: 'default',
  }));

  const dead = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const json = await res.json().catch(() => null);
      const tickets = json?.data || [];
      tickets.forEach((ticket, index) => {
        if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
          dead.push(batch[index].to);
        }
      });
    } catch (err) {
      console.error('[push] send failed:', err.message);
    }
  }
  return { dead };
}

/**
 * Push every registered device of one user, then drop any tokens Expo says are dead.
 * Fire-and-forget from callers (notifyUser awaits it but swallows errors).
 */
export async function pushToUser(userId, { title, body, data }) {
  if (!userId || !title) return;
  try {
    const rows = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    if (rows.length === 0) return;
    const { dead } = await sendExpoPush(rows.map((r) => r.token), { title, body, data });
    if (dead.length) {
      await prisma.pushToken.deleteMany({ where: { token: { in: dead } } }).catch(() => {});
    }
  } catch (err) {
    console.error('[pushToUser]', err.message);
  }
}
