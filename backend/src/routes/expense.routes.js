import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { notifyUser } from '../utils/notify.js';

export const expenseRouter = Router();

// GET /api/trips/:id/expenses
expenseRouter.get('/:id/expenses', authenticate, async (req, res) => {
    const expenses = await prisma.expense.findMany({
        where: { tripId: req.params.id },
        include: {
            payer: { select: { id: true, name: true, avatarUrl: true } },
            shares: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        },
        orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: expenses });
});

// POST /api/trips/:id/expenses
expenseRouter.post('/:id/expenses', authenticate, async (req, res) => {
    const { title, amount, currency, category, date, splitWith } = req.body;
    // splitWith: array of { userId, amount }

    const expense = await prisma.expense.create({
        data: {
            tripId: req.params.id,
            payerId: req.user.id,
            title, amount: Number(amount), currency, category,
            date: date ? new Date(date) : new Date(),
            shares: {
                create: splitWith?.map((s) => ({ userId: s.userId, amount: Number(s.amount) })) || [],
            },
        },
        include: { payer: { select: { id: true, name: true, avatarUrl: true } }, shares: true },
    });

    const trip = await prisma.trip.findUnique({
        where: { id: req.params.id },
        select: { title: true },
    });
    const notifyIds = new Set(
        (splitWith || []).map((s) => s.userId).filter((uid) => uid && uid !== req.user.id)
    );
    await Promise.all(
        [...notifyIds].map((userId) =>
            notifyUser({
                userId,
                type: 'EXPENSE_ADDED',
                title: 'New shared expense',
                body: `${req.user.name} added “${title}” (₹${Number(amount).toLocaleString()}) on ${trip?.title || 'a trip'}.`,
                data: { tripId: req.params.id, expenseId: expense.id },
            })
        )
    );

    res.status(201).json({ success: true, data: expense });
});

// DELETE /api/trips/:id/expenses/:expenseId
expenseRouter.delete('/:id/expenses/:expenseId', authenticate, async (req, res) => {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.expenseId } });
    if (!expense) throw new AppError('Expense not found.', 404);
    if (expense.payerId !== req.user.id && req.user.role !== 'ADMIN') {
        throw new AppError('Only the payer can delete this expense.', 403);
    }
    await prisma.expense.delete({ where: { id: req.params.expenseId } });
    res.json({ success: true, message: 'Expense deleted.' });
});

// GET /api/trips/:id/expenses/balances — who owes whom
expenseRouter.get('/:id/expenses/balances', authenticate, async (req, res) => {
    const expenses = await prisma.expense.findMany({
        where: { tripId: req.params.id },
        include: { shares: true },
    });

    // Simple balance calculation
    const balances = {};
    for (const exp of expenses) {
        const payerId = exp.payerId;
        if (!balances[payerId]) balances[payerId] = 0;
        balances[payerId] += exp.amount;

        for (const share of exp.shares) {
            if (!balances[share.userId]) balances[share.userId] = 0;
            balances[share.userId] -= share.amount;
        }
    }

    res.json({ success: true, data: balances });
});
