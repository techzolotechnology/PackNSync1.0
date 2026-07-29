import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
    dayCount,
    generateExploreItinerary,
    regenerateExploreItinerary,
} from '../utils/explorePlanner.js';
import { isOpenAiConfigured } from '../utils/exploreLlm.js';

const PACES = new Set(['relaxed', 'balanced', 'packed']);
const BUDGETS = new Set(['budget', 'mid', 'luxury']);
const TRAVELERS = new Set(['solo', 'couple', 'family', 'friends', 'work', 'backpacker']);

const planInclude = {
    days: {
        orderBy: { dayNumber: 'asc' },
        include: {
            stops: { orderBy: { sortOrder: 'asc' } },
        },
    },
};

function parsePrefs(body = {}) {
    const destination = String(body.destination || '').trim();
    const startDate = body.startDate;
    const endDate = body.endDate;
    const pace = String(body.pace || 'balanced').toLowerCase();
    const budget = String(body.budget || 'mid').toLowerCase();
    const travelerType = String(body.travelerType || 'solo').toLowerCase();
    const interests = Array.isArray(body.interests)
        ? body.interests.map((i) => String(i).trim()).filter(Boolean).slice(0, 12)
        : String(body.interests || '')
            .split(',')
            .map((i) => i.trim())
            .filter(Boolean)
            .slice(0, 12);
    const notes = body.notes ? String(body.notes).trim().slice(0, 500) : null;

    if (!destination) throw new AppError('Destination is required.', 400);
    if (!startDate || !endDate) throw new AppError('Start and end dates are required.', 400);

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new AppError('Invalid dates.', 400);
    }
    if (end < start) throw new AppError('End date must be on or after start date.', 400);
    if (dayCount(start, end) > 14) throw new AppError('Plans are limited to 14 days.', 400);
    if (!PACES.has(pace)) throw new AppError('Pace must be relaxed, balanced, or packed.', 400);
    if (!BUDGETS.has(budget)) throw new AppError('Budget must be budget, mid, or luxury.', 400);
    if (!TRAVELERS.has(travelerType)) {
        throw new AppError('Traveler type is invalid.', 400);
    }

    return {
        destination,
        startDate: start,
        endDate: end,
        pace,
        budget,
        travelerType,
        interests,
        notes,
    };
}

async function replacePlanDays(planId, days) {
    await prisma.explorePlanDay.deleteMany({ where: { planId } });
    for (const day of days) {
        await prisma.explorePlanDay.create({
            data: {
                planId,
                dayNumber: day.dayNumber,
                title: day.title,
                theme: day.theme || null,
                summary: day.summary || null,
                stops: {
                    create: (day.stops || []).map((s, idx) => ({
                        sortOrder: s.sortOrder ?? idx,
                        name: s.name,
                        address: s.address || null,
                        lat: s.lat ?? null,
                        lng: s.lng ?? null,
                        startTime: s.startTime || null,
                        endTime: s.endTime || null,
                        category: s.category || null,
                        reason: s.reason || null,
                        energy: s.energy || null,
                        notes: s.notes || null,
                    })),
                },
            },
        });
    }
}

async function getOwnedPlan(planId, userId) {
    const plan = await prisma.explorePlan.findUnique({
        where: { id: planId },
        include: planInclude,
    });
    if (!plan) throw new AppError('Plan not found.', 404);
    if (plan.userId !== userId) throw new AppError('Not allowed to access this plan.', 403);
    return plan;
}

function serializePlan(plan, extra = {}) {
    return {
        ...plan,
        ...extra,
        mapPlaces: (plan.days || []).flatMap((d) =>
            (d.stops || [])
                .filter((s) => s.lat != null && s.lng != null)
                .map((s) => ({
                    id: s.id,
                    name: s.name,
                    address: s.address,
                    lat: s.lat,
                    lng: s.lng,
                    dayNumber: d.dayNumber,
                    startTime: s.startTime,
                    reason: s.reason,
                }))),
    };
}

// POST /api/explore/plans/generate
export const generateExplorePlan = async (req, res) => {
    const prefs = parsePrefs(req.body);
    const generated = await generateExploreItinerary({
        ...prefs,
        startDate: prefs.startDate.toISOString().slice(0, 10),
        endDate: prefs.endDate.toISOString().slice(0, 10),
    });

    const plan = await prisma.explorePlan.create({
        data: {
            userId: req.user.id,
            title: generated.title,
            destination: prefs.destination,
            startDate: prefs.startDate,
            endDate: prefs.endDate,
            pace: prefs.pace,
            budget: prefs.budget,
            travelerType: prefs.travelerType,
            interests: prefs.interests,
            notes: prefs.notes,
            summary: generated.summary,
            status: 'DRAFT',
        },
    });

    await replacePlanDays(plan.id, generated.days);
    const full = await getOwnedPlan(plan.id, req.user.id);

    res.status(201).json({
        success: true,
        data: serializePlan(full, { source: generated.source }),
        message: `Created a ${generated.dayCount}-day plan for ${prefs.destination}.`,
    });
};

// GET /api/explore/plans
export const listExplorePlans = async (req, res) => {
    const plans = await prisma.explorePlan.findMany({
        where: { userId: req.user.id },
        include: {
            days: {
                orderBy: { dayNumber: 'asc' },
                include: { _count: { select: { stops: true } } },
            },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
    });

    res.json({
        success: true,
        data: plans.map((p) => ({
            id: p.id,
            title: p.title,
            destination: p.destination,
            startDate: p.startDate,
            endDate: p.endDate,
            pace: p.pace,
            budget: p.budget,
            travelerType: p.travelerType,
            status: p.status,
            summary: p.summary,
            dayCount: p.days.length,
            stopCount: p.days.reduce((n, d) => n + (d._count?.stops || 0), 0),
            updatedAt: p.updatedAt,
        })),
    });
};

// GET /api/explore/plans/:id
export const getExplorePlan = async (req, res) => {
    const plan = await getOwnedPlan(req.params.id, req.user.id);
    res.json({ success: true, data: serializePlan(plan) });
};

// PUT /api/explore/plans/:id — edit title/notes/status/days
export const updateExplorePlan = async (req, res) => {
    const existing = await getOwnedPlan(req.params.id, req.user.id);
    const {
        title, notes, summary, status, days, interests,
    } = req.body || {};

    const data = {};
    if (title != null) data.title = String(title).trim().slice(0, 140) || existing.title;
    if (notes !== undefined) data.notes = notes ? String(notes).trim().slice(0, 500) : null;
    if (summary !== undefined) data.summary = summary ? String(summary).trim().slice(0, 400) : null;
    if (interests !== undefined) {
        data.interests = Array.isArray(interests)
            ? interests.map((i) => String(i).trim()).filter(Boolean).slice(0, 12)
            : existing.interests;
    }
    if (status != null) {
        const s = String(status).toUpperCase();
        if (s !== 'DRAFT' && s !== 'SAVED') throw new AppError('Status must be DRAFT or SAVED.', 400);
        data.status = s;
    }

    await prisma.explorePlan.update({
        where: { id: existing.id },
        data,
    });

    if (Array.isArray(days)) {
        const normalized = days.map((d, i) => ({
            dayNumber: Number(d.dayNumber) || i + 1,
            title: String(d.title || `Day ${i + 1}`).slice(0, 120),
            theme: d.theme ? String(d.theme).slice(0, 80) : null,
            summary: d.summary ? String(d.summary).slice(0, 280) : null,
            stops: (Array.isArray(d.stops) ? d.stops : []).map((s, idx) => ({
                sortOrder: s.sortOrder ?? idx,
                name: String(s.name || `Stop ${idx + 1}`).slice(0, 120),
                address: s.address ? String(s.address).slice(0, 240) : null,
                lat: typeof s.lat === 'number' ? s.lat : (s.lat != null ? Number(s.lat) : null),
                lng: typeof s.lng === 'number' ? s.lng : (s.lng != null ? Number(s.lng) : null),
                startTime: s.startTime || null,
                endTime: s.endTime || null,
                category: s.category || null,
                reason: s.reason || null,
                energy: s.energy || null,
                notes: s.notes || null,
            })),
        }));
        await replacePlanDays(existing.id, normalized);
    }

    const full = await getOwnedPlan(existing.id, req.user.id);
    res.json({ success: true, data: serializePlan(full), message: 'Plan updated.' });
};

// POST /api/explore/plans/:id/regenerate
export const regenerateExplorePlan = async (req, res) => {
    const existing = await getOwnedPlan(req.params.id, req.user.id);
    const dayNumber = req.body?.dayNumber != null ? Number(req.body.dayNumber) : null;
    if (dayNumber != null && (Number.isNaN(dayNumber) || dayNumber < 1)) {
        throw new AppError('dayNumber must be a positive integer.', 400);
    }

    const prefs = {
        destination: existing.destination,
        startDate: existing.startDate.toISOString().slice(0, 10),
        endDate: existing.endDate.toISOString().slice(0, 10),
        pace: existing.pace,
        budget: existing.budget,
        travelerType: existing.travelerType,
        interests: existing.interests,
        notes: existing.notes,
    };

    const generated = await regenerateExploreItinerary(
        prefs,
        {
            title: existing.title,
            summary: existing.summary,
            days: existing.days.map((d) => ({
                dayNumber: d.dayNumber,
                title: d.title,
                theme: d.theme,
                summary: d.summary,
                stops: d.stops,
            })),
        },
        dayNumber,
    );

    await prisma.explorePlan.update({
        where: { id: existing.id },
        data: {
            title: generated.title || existing.title,
            summary: generated.summary || existing.summary,
        },
    });
    await replacePlanDays(existing.id, generated.days);

    const full = await getOwnedPlan(existing.id, req.user.id);
    res.json({
        success: true,
        data: serializePlan(full, { source: generated.source }),
        message: dayNumber ? `Day ${dayNumber} regenerated.` : 'Full plan regenerated.',
    });
};

// POST /api/explore/plans/:id/save
export const saveExplorePlan = async (req, res) => {
    await getOwnedPlan(req.params.id, req.user.id);
    const plan = await prisma.explorePlan.update({
        where: { id: req.params.id },
        data: { status: 'SAVED' },
        include: planInclude,
    });
    res.json({ success: true, data: serializePlan(plan), message: 'Plan saved.' });
};

// DELETE /api/explore/plans/:id
export const deleteExplorePlan = async (req, res) => {
    await getOwnedPlan(req.params.id, req.user.id);
    await prisma.explorePlan.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Plan deleted.' });
};

// PATCH /api/explore/plans/:id/stops/:stopId
export const updateExplorePlanStop = async (req, res) => {
    const { id: planId, stopId } = req.params;
    await getOwnedPlan(planId, req.user.id);

    const stop = await prisma.explorePlanStop.findUnique({
        where: { id: stopId },
        include: { day: { select: { planId: true } } },
    });
    if (!stop || stop.day.planId !== planId) throw new AppError('Stop not found.', 404);

    const allowed = ['name', 'address', 'lat', 'lng', 'startTime', 'endTime', 'category', 'reason', 'energy', 'notes', 'sortOrder'];
    const data = {};
    for (const key of allowed) {
        if (req.body?.[key] !== undefined) data[key] = req.body[key];
    }
    if (data.name != null) {
        data.name = String(data.name).trim().slice(0, 120);
        if (!data.name) throw new AppError('Stop name cannot be empty.', 400);
    }

    await prisma.explorePlanStop.update({ where: { id: stopId }, data });
    const full = await getOwnedPlan(planId, req.user.id);
    res.json({ success: true, data: serializePlan(full), message: 'Stop updated.' });
};

export const deleteExplorePlanStop = async (req, res) => {
    const { id: planId, stopId } = req.params;
    await getOwnedPlan(planId, req.user.id);
    const stop = await prisma.explorePlanStop.findUnique({
        where: { id: stopId },
        include: { day: { select: { planId: true } } },
    });
    if (!stop || stop.day.planId !== planId) throw new AppError('Stop not found.', 404);
    await prisma.explorePlanStop.delete({ where: { id: stopId } });
    const full = await getOwnedPlan(planId, req.user.id);
    res.json({ success: true, data: serializePlan(full), message: 'Stop removed.' });
};

export const getExplorePlannerMeta = async (_req, res) => {
    res.json({
        success: true,
        data: {
            openai: isOpenAiConfigured(),
            paces: [...PACES],
            budgets: [...BUDGETS],
            travelerTypes: [...TRAVELERS],
            interestSuggestions: [
                'food', 'coffee', 'nightlife', 'temples', 'nature', 'shopping',
                'beaches', 'history', 'photography', 'adventure', 'wellness',
            ],
            maxDays: 14,
        },
    });
};
