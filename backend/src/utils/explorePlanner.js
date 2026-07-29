/**
 * AI day-by-day trip planner for Explore.
 * Uses OpenAI when configured; otherwise a structured heuristic plan.
 */

import { isOpenAiConfigured } from './exploreLlm.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'PackAndSync/1.0 (explore-planner; contact=dev@packandsync.local)';

const PACE_STOPS = { relaxed: 3, balanced: 4, packed: 5 };
const BUDGET_HINT = {
    budget: 'prefer free/cheap eats, public spots, local markets',
    mid: 'mix of popular mid-range cafes, attractions, and dinners',
    luxury: 'premium hotels vibes, fine dining, private experiences (realistic names)',
};
const TRAVELER_HINT = {
    solo: 'solo-friendly, safe, flexible pacing',
    couple: 'romantic / shared experiences, quieter evenings',
    family: 'kid-friendly, shorter walks, earlier evenings',
    friends: 'group-friendly, lively spots, shared meals',
    work: 'cafes with Wi‑Fi, lighter evenings, efficient routing',
    backpacker: 'hostels areas, cheap eats, public transport friendly',
};

function dayCount(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);
    const diff = Math.round((end - start) / 86400000) + 1;
    return Math.min(14, Math.max(1, diff));
}

function datePlus(startDate, offsetDays) {
    const d = new Date(startDate);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
}

async function chatJson(system, user) {
    const key = process.env.OPENAI_API_KEY.trim();
    const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.45,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
        }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

async function geocodeOne(query) {
    try {
        const url = new URL(NOMINATIM);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '1');
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return null;
        const rows = await res.json();
        if (!rows?.[0]) return null;
        return {
            lat: Number(rows[0].lat),
            lng: Number(rows[0].lon),
            address: rows[0].display_name || query,
        };
    } catch {
        return null;
    }
}

function normalizeDay(src, dayNumber, prefs) {
    const stopsPerDay = PACE_STOPS[prefs.pace] || 4;
    const stopsSrc = Array.isArray(src?.stops) ? src.stops : [];
    const stops = stopsSrc.slice(0, stopsPerDay + 1).map((s, idx) => ({
        sortOrder: idx,
        name: String(s.name || `Stop ${idx + 1}`).slice(0, 120),
        address: s.address ? String(s.address).slice(0, 240) : null,
        lat: typeof s.lat === 'number' ? s.lat : null,
        lng: typeof s.lng === 'number' ? s.lng : null,
        startTime: s.startTime ? String(s.startTime).slice(0, 8) : null,
        endTime: s.endTime ? String(s.endTime).slice(0, 8) : null,
        category: s.category ? String(s.category).slice(0, 40) : 'activity',
        reason: s.reason ? String(s.reason).slice(0, 220) : null,
        energy: ['low', 'medium', 'high'].includes(s.energy) ? s.energy : 'medium',
        notes: s.notes ? String(s.notes).slice(0, 240) : null,
    }));

    while (stops.length < Math.min(2, stopsPerDay)) {
        stops.push({
            sortOrder: stops.length,
            name: `${prefs.destination} highlight`,
            address: prefs.destination,
            lat: null,
            lng: null,
            startTime: `${10 + stops.length}:00`,
            endTime: `${11 + stops.length}:30`,
            category: 'sightseeing',
            reason: 'Fills the day based on your pace.',
            energy: 'medium',
            notes: null,
        });
    }

    return {
        dayNumber,
        title: String(src?.title || `Day ${dayNumber} in ${prefs.destination}`).slice(0, 120),
        theme: src?.theme ? String(src.theme).slice(0, 80) : null,
        summary: src?.summary ? String(src.summary).slice(0, 280) : null,
        stops,
    };
}

function normalizePlanPayload(raw, prefs) {
    const daysWanted = dayCount(prefs.startDate, prefs.endDate);
    const daysIn = Array.isArray(raw?.days) ? raw.days : [];
    const days = [];

    for (let i = 0; i < daysWanted; i += 1) {
        const src = daysIn.find((d) => Number(d.dayNumber) === i + 1) || daysIn[i] || {};
        days.push(normalizeDay(src, i + 1, prefs));
    }

    return {
        title: String(raw?.title || `${prefs.destination} · ${daysWanted}-day plan`).slice(0, 140),
        summary: String(raw?.summary || `Personalized ${prefs.travelerType} trip to ${prefs.destination}.`).slice(0, 400),
        days,
    };
}

function heuristicPlan(prefs) {
    const daysWanted = dayCount(prefs.startDate, prefs.endDate);
    const stopsPerDay = PACE_STOPS[prefs.pace] || 4;
    const interests = prefs.interests?.length
        ? prefs.interests
        : ['food', 'views', 'local culture'];
    const templates = [
        { category: 'cafe', name: 'Morning café', energy: 'low', start: '09:00', end: '10:30' },
        { category: 'sightseeing', name: 'Signature landmark', energy: 'medium', start: '11:00', end: '13:00' },
        { category: 'food', name: 'Local lunch spot', energy: 'low', start: '13:15', end: '14:30' },
        { category: 'outdoors', name: 'Park / viewpoint walk', energy: 'medium', start: '15:00', end: '17:00' },
        { category: 'food', name: 'Dinner neighborhood', energy: 'low', start: '19:00', end: '21:00' },
        { category: 'nightlife', name: 'Evening hangout', energy: 'high', start: '21:15', end: '22:30' },
    ];

    const days = [];
    for (let i = 0; i < daysWanted; i += 1) {
        const interest = interests[i % interests.length];
        const picks = templates.slice(0, stopsPerDay).map((t, idx) => ({
            sortOrder: idx,
            name: `${prefs.destination} · ${t.name} (${interest})`,
            address: `${prefs.destination}, India`,
            lat: null,
            lng: null,
            startTime: t.start,
            endTime: t.end,
            category: t.category,
            reason: `Fits a ${prefs.pace} ${prefs.travelerType} day focused on ${interest}. ${BUDGET_HINT[prefs.budget]}.`,
            energy: t.energy,
            notes: null,
        }));
        days.push({
            dayNumber: i + 1,
            title: `Day ${i + 1}: ${interest} & ${prefs.destination}`,
            theme: interest,
            summary: `Clustered stops for ${datePlus(prefs.startDate, i)} — ${TRAVELER_HINT[prefs.travelerType]}.`,
            stops: picks,
        });
    }

    return {
        title: `${prefs.destination} · ${daysWanted}-day ${prefs.travelerType} plan`,
        summary: `Heuristic plan for ${prefs.destination} (${prefs.pace} pace, ${prefs.budget} budget). Add OpenAI key for richer named places.`,
        days,
        source: 'heuristic',
    };
}

async function enrichStopsWithCoords(plan, destination) {
    const destGeo = await geocodeOne(`${destination}, India`);
    const days = [];
    for (const day of plan.days) {
        const stops = [];
        for (const stop of day.stops) {
            if (stop.lat != null && stop.lng != null) {
                stops.push(stop);
                continue;
            }
            const geo = await geocodeOne(`${stop.name}, ${destination}, India`);
            // small delay-friendly: if fail, offset from destination
            if (geo) {
                stops.push({
                    ...stop,
                    lat: geo.lat,
                    lng: geo.lng,
                    address: stop.address || geo.address,
                });
            } else if (destGeo) {
                const jitter = (day.dayNumber * 0.01) + (stop.sortOrder * 0.004);
                stops.push({
                    ...stop,
                    lat: destGeo.lat + jitter,
                    lng: destGeo.lng + (stop.sortOrder * 0.003),
                    address: stop.address || destGeo.address,
                });
            } else {
                stops.push(stop);
            }
        }
        // light geographic sort within day when coords exist
        const withCoords = stops.filter((s) => s.lat != null && s.lng != null);
        if (withCoords.length >= 2) {
            const anchor = withCoords[0];
            stops.sort((a, b) => {
                if (a.lat == null || b.lat == null) return a.sortOrder - b.sortOrder;
                const da = Math.hypot(a.lat - anchor.lat, a.lng - anchor.lng);
                const db = Math.hypot(b.lat - anchor.lat, b.lng - anchor.lng);
                return da - db;
            });
            stops.forEach((s, i) => { s.sortOrder = i; });
        }
        days.push({ ...day, stops });
    }
    return { ...plan, days };
}

/**
 * Generate a full multi-day itinerary.
 */
export async function generateExploreItinerary(prefs) {
    const daysWanted = dayCount(prefs.startDate, prefs.endDate);
    const stopsPerDay = PACE_STOPS[prefs.pace] || 4;

    let raw;
    let source = 'heuristic';

    if (isOpenAiConfigured()) {
        try {
            raw = await chatJson(
                `You are PackAndSync trip planner for India.
Return JSON only:
{
  "title": string,
  "summary": string,
  "days":[
    {
      "dayNumber": 1,
      "title": string,
      "theme": string,
      "summary": string,
      "stops":[
        {
          "name": "real or realistic place name",
          "address": "area, city",
          "lat": number|null,
          "lng": number|null,
          "startTime": "HH:MM",
          "endTime": "HH:MM",
          "category": "cafe|food|sightseeing|outdoors|shopping|nightlife|culture|activity",
          "reason": "why it fits (max 140 chars)",
          "energy": "low|medium|high",
          "notes": "optional tip"
        }
      ]
    }
  ]
}
Rules:
- Exactly ${daysWanted} days, about ${stopsPerDay} stops each.
- Order stops by neighborhood flow (minimize zig-zag).
- Match pace (${prefs.pace}): relaxed=lighter mornings/earlier nights; packed=more stops.
- Match traveler (${prefs.travelerType}): ${TRAVELER_HINT[prefs.travelerType] || ''}.
- Match budget (${prefs.budget}): ${BUDGET_HINT[prefs.budget] || ''}.
- Vary energy across the day (not all high).
- Prefer known areas/landmarks in the destination.`,
                `Destination: ${prefs.destination}
Dates: ${prefs.startDate} → ${prefs.endDate} (${daysWanted} days)
Pace: ${prefs.pace}
Budget: ${prefs.budget}
Traveler: ${prefs.travelerType}
Interests: ${(prefs.interests || []).join(', ') || 'general'}
Notes: ${prefs.notes || '(none)'}`,
            );
            source = 'openai';
        } catch (err) {
            console.warn('[explorePlanner] LLM failed, heuristic:', err.message);
            raw = heuristicPlan(prefs);
            source = 'heuristic';
        }
    } else {
        raw = heuristicPlan(prefs);
    }

    let plan = normalizePlanPayload(raw, prefs);
    plan = await enrichStopsWithCoords(plan, prefs.destination);
    return { ...plan, source, dayCount: daysWanted };
}

/**
 * Regenerate one day or the whole plan.
 */
export async function regenerateExploreItinerary(prefs, existingPlan, dayNumber = null) {
    if (dayNumber == null) {
        return generateExploreItinerary(prefs);
    }

    if (!isOpenAiConfigured()) {
        const full = heuristicPlan(prefs);
        const one = full.days.find((d) => d.dayNumber === dayNumber) || full.days[0];
        const merged = {
            ...existingPlan,
            days: existingPlan.days.map((d) => (d.dayNumber === dayNumber
                ? { ...one, dayNumber }
                : d)),
            source: 'heuristic',
        };
        return enrichStopsWithCoords(merged, prefs.destination);
    }

    try {
        const raw = await chatJson(
            `Regenerate ONLY day ${dayNumber} of an India trip plan. Return JSON:
{"day":{"dayNumber":${dayNumber},"title":string,"theme":string,"summary":string,"stops":[...same stop shape...]}}
Keep ~${PACE_STOPS[prefs.pace] || 4} stops, geographic flow, pace/budget/traveler fit.
Do not repeat the same stops already used on other days if possible.`,
            `Prefs: ${JSON.stringify({
                destination: prefs.destination,
                pace: prefs.pace,
                budget: prefs.budget,
                travelerType: prefs.travelerType,
                interests: prefs.interests,
            })}
Other days: ${JSON.stringify(existingPlan.days.filter((d) => d.dayNumber !== dayNumber).map((d) => ({
                dayNumber: d.dayNumber,
                title: d.title,
                stops: d.stops.map((s) => s.name),
            })))}
Replace day ${dayNumber}.`,
        );

        const dayPayload = raw.day || raw;
        const fixed = normalizeDay(dayPayload, dayNumber, prefs);
        const merged = {
            title: existingPlan.title,
            summary: existingPlan.summary,
            days: existingPlan.days.map((d) => (d.dayNumber === dayNumber ? fixed : d)),
            source: 'openai',
        };
        return enrichStopsWithCoords(merged, prefs.destination);
    } catch (err) {
        console.warn('[explorePlanner] day regen failed:', err.message);
        const full = heuristicPlan(prefs);
        const one = full.days.find((d) => d.dayNumber === dayNumber) || full.days[0];
        const merged = {
            title: existingPlan.title,
            summary: existingPlan.summary,
            days: existingPlan.days.map((d) => (d.dayNumber === dayNumber
                ? { ...one, dayNumber }
                : d)),
            source: 'heuristic',
        };
        return enrichStopsWithCoords(merged, prefs.destination);
    }
}

export { dayCount };
