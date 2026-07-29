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
