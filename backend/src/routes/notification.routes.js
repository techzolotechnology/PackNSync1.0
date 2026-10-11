import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const notificationRouter = Router();

// GET /api/notifications — current user's notifications
notificationRouter.get('/', authenticate, async (req, res) => {
    const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.json({ success: true, data: notifications });
});

// PUT /api/notifications/read-all
notificationRouter.put('/read-all', authenticate, async (req, res) => {
    await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true },
    });
    res.json({ success: true });
});

// PUT /api/notifications/:id/read
notificationRouter.put('/:id/read', authenticate, async (req, res) => {
    await prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.id },
        data: { isRead: true },
    });
    res.json({ success: true });
});

const isExpoToken = (t) => typeof t === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(t.trim());

// POST /api/notifications/push/register { token, platform } — save this device's Expo push token.
notificationRouter.post('/push/register', authenticate, async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const platform = req.body?.platform ? String(req.body.platform).slice(0, 20) : null;
    if (!isExpoToken(token)) {
        return res.status(400).json({ success: false, message: 'A valid Expo push token is required.' });
    }
    // One row per token; if the device re-registers under a new account, move the token.
    await prisma.pushToken.upsert({
        where: { token },
        create: { userId: req.user.id, token, platform },
        update: { userId: req.user.id, platform },
    });
    res.json({ success: true });
});

// POST /api/notifications/push/unregister { token } — drop this device (called on logout).
notificationRouter.post('/push/unregister', authenticate, async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (token) {
        await prisma.pushToken.deleteMany({ where: { token, userId: req.user.id } });
    }
    res.json({ success: true });
});
