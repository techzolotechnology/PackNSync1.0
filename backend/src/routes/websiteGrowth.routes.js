import { json, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { parseGrowthEvent } from '../../../shared/websiteGrowth.mjs';
import { prisma } from '../utils/prisma.js';

export const websiteGrowthRouter = Router();

websiteGrowthRouter.post(
    '/',
    rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }),
    json({ limit: '1kb' }),
    async (req, res) => {
        if (req.get('Sec-GPC') === '1' || req.get('DNT') === '1') return res.sendStatus(204);
        const data = parseGrowthEvent(req.body);
        if (!data) return res.sendStatus(400);

        const { event, source, landing, market, vehicle } = data;
        await prisma.$executeRaw`
            INSERT INTO "WebsiteGrowthDaily" ("day", "event", "source", "landing", "market", "vehicle", "count")
            VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date, ${event}, ${source}, ${landing}, ${market}, ${vehicle}, 1)
            ON CONFLICT ("day", "event", "source", "landing", "market", "vehicle")
            DO UPDATE SET "count" = "WebsiteGrowthDaily"."count" + 1
        `;
        return res.sendStatus(204);
    },
);

export async function readWebsiteGrowth(_req, res) {
    const data = await prisma.$queryRaw`
        SELECT "event", "source", "landing", "market", "vehicle", SUM("count")::float8 AS "count"
        FROM "WebsiteGrowthDaily"
        WHERE "day" >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - 29
        GROUP BY "event", "source", "landing", "market", "vehicle"
        ORDER BY "count" DESC, "event", "source", "landing", "market", "vehicle"
    `;
    res.json({ success: true, data });
}
