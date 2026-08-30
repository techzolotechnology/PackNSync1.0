/**
 * OpenAI helpers for Explore (intent parse + place reasons).
 * Requires OPENAI_API_KEY in backend/.env
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export const isOpenAiConfigured = () => {
    const key = process.env.OPENAI_API_KEY?.trim();
    return Boolean(key && !key.includes('your_') && key.startsWith('sk-'));
};

async function chatJson(system, user, { model } = {}) {
    const key = process.env.OPENAI_API_KEY.trim();
    const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
        }),
    });

    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn('[OpenAI]', res.status, errText.slice(0, 300));
        throw new Error(`OpenAI error ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
}

/**
 * Refine keyword parse with LLM structured intent.
 */
export async function refineExploreIntent(rawQuery, baseParsed) {
    if (!isOpenAiConfigured()) return baseParsed;

    try {
        const out = await chatJson(
            `You extract travel place-search intent for India. Return JSON only:
{"city": string|null, "geocodeQuery": string|null, "intents": string[], "searchQuery": string, "nearMe": boolean}
intents subset of: romantic,quiet,drinks,coffee,food,beach,outdoors,budget,family,friends,local
searchQuery should be a Google Places text query (include city if known).`,
            `User query: ${rawQuery}\nKeyword parse: ${JSON.stringify(baseParsed)}`,
        );

        return {
            ...baseParsed,
            city: out.city || baseParsed.city,
            geocodeQuery: out.geocodeQuery || baseParsed.geocodeQuery,
            intents: Array.isArray(out.intents) && out.intents.length ? out.intents : baseParsed.intents,
            nearMe: Boolean(out.nearMe) || baseParsed.nearMe,
            searchQuery: out.searchQuery || rawQuery,
            llm: true,
        };
    } catch (err) {
        console.warn('[exploreLlm] intent refine skipped:', err.message);
        return baseParsed;
    }
}

/**
 * Write short "why it fits" + "best for" labels for ranked places.
 */
export async function enrichPlaceReasons(rawQuery, places, history = []) {
    if (!places?.length) return places;

    if (!isOpenAiConfigured()) {
        return places.map((p) => ({
            ...p,
            bestFor: p.bestFor || inferBestFor(p, rawQuery),
            reason: p.reason || 'Matches your search',
        }));
    }

    try {
        const compact = places.map((p, i) => ({
            i,
            name: p.name,
            address: p.address,
            categories: p.categories,
            rating: p.rating,
            distanceKm: p.distanceKm,
            priceLevel: p.priceLevel,
        }));

        const recent = (history || [])
            .slice(-6)
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');

        const out = await chatJson(
            `You help travelers pick places in India. Return JSON:
{"places":[{"i":0,"bestFor":"3-6 words use-case","reason":"1 sentence why it fits (max 140 chars)","fitScore":1-10}]}
bestFor examples: "quiet date drinks", "budget group dinner", "morning walk with kids"
Be concrete. Use ratings/distance if given.`,
            `Latest query: ${rawQuery}\nRecent chat:\n${recent || '(none)'}\nPlaces: ${JSON.stringify(compact)}`,
        );

        const map = new Map(
            (out.places || []).map((r) => [Number(r.i), r]),
        );

        return places.map((p, i) => {
            const note = map.get(i);
            return {
                ...p,
                bestFor: note?.bestFor || p.bestFor || inferBestFor(p, rawQuery),
                reason: note?.reason || p.reason,
                fitScore: note?.fitScore ?? p.fitScore ?? null,
                reasonSource: note ? 'openai' : p.reasonSource || 'rules',
            };
        });
    } catch (err) {
        console.warn('[exploreLlm] reasons skipped:', err.message);
        return places.map((p) => ({
            ...p,
            bestFor: p.bestFor || inferBestFor(p, rawQuery),
        }));
    }
}

function inferBestFor(place, query = '') {
    const cats = (place.categories || []).join(' ');
    const q = query.toLowerCase();
    if (q.includes('romantic') || q.includes('date')) return 'Date night / romantic stop';
    if (q.includes('coffee') || cats.includes('cafe')) return 'Coffee & casual hang';
    if (q.includes('drink') || cats.includes('bar') || cats.includes('pub')) return 'Drinks & nightlife';
    if (q.includes('park') || cats.includes('park')) return 'Outdoors & walk';
    if (q.includes('beach') || cats.includes('beach')) return 'Beach time';
    if (q.includes('family')) return 'Family-friendly outing';
    if (q.includes('budget') || place.priceLevel === 0 || place.priceLevel === 1) return 'Budget-friendly pick';
    if (cats.includes('restaurant')) return 'Meal / dinner';
    return 'Good match for your ask';
}

/**
 * Multi-turn: decide reply + whether to re-search, using chat history.
 */
export async function planExploreChatTurn({ history, userMessage, lastPlaces }) {
    const fallback = {
        assistantMessage: `I'll look for places that fit: “${userMessage}”.`,
        shouldSearch: true,
        searchQuery: userMessage,
        city: null,
        intents: [],
        nearMe: /\bnear me\b/i.test(userMessage),
    };

    if (!isOpenAiConfigured()) {
        return fallback;
    }

    try {
        const hist = (history || [])
            .slice(-10)
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');
        const placeNames = (lastPlaces || []).slice(0, 8).map((p, i) => `${i + 1}. ${p.name}`).join('\n');

        const out = await chatJson(
            `You are PickAndSync Explore — a map concierge for India.
Return JSON only:
{
  "assistantMessage": "short friendly reply (2-4 sentences max)",
  "shouldSearch": boolean,
  "searchQuery": "Google Places style query if shouldSearch",
  "city": string|null,
  "intents": string[],
  "nearMe": boolean
}
If user refines (cheaper, closer, more romantic, different area), shouldSearch=true and rewrite searchQuery with full context.
If user only asks about already listed places, shouldSearch=false and answer in assistantMessage.
intents: romantic,quiet,drinks,coffee,food,beach,outdoors,budget,family,friends,local`,
            `Chat:\n${hist || '(new)'}\nUser now: ${userMessage}\nCurrent places:\n${placeNames || '(none)'}`,
        );

        return {
            assistantMessage: out.assistantMessage || fallback.assistantMessage,
            shouldSearch: out.shouldSearch !== false,
            searchQuery: out.searchQuery || userMessage,
            city: out.city || null,
            intents: Array.isArray(out.intents) ? out.intents : [],
            nearMe: Boolean(out.nearMe),
            llm: true,
        };
    } catch (err) {
        console.warn('[exploreLlm] chat turn skipped:', err.message);
        return fallback;
    }
}
