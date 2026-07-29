import { AppError } from '../utils/AppError.js';
import { searchExplorePlaces } from '../utils/exploreSearch.js';
import {
    enrichPlaceReasons,
    isOpenAiConfigured,
    planExploreChatTurn,
} from '../utils/exploreLlm.js';
import { isGooglePlacesConfigured } from '../utils/exploreGooglePlaces.js';
import {
    appendExploreMessage,
    clearExploreSession,
    getOrCreateExploreSession,
    publicSession,
    updateExploreSessionSearch,
} from '../utils/exploreSessions.js';

// POST /api/explore/search — one-shot (still supported)
export const searchExplore = async (req, res) => {
    const { query, limit, lat, lng } = req.body || {};
    if (!query?.trim()) {
        throw new AppError('Enter a place query, e.g. “quiet romantic drinks in Bangalore”.', 400);
    }

    const { parsed, results, center, source, providers } = await searchExplorePlaces(query, {
        limit: limit || 5,
        lat,
        lng,
    });

    res.json({
        success: true,
        data: {
            query: parsed.raw,
            source: source || 'openstreetmap',
            providers: providers || {},
            center,
            intent: {
                city: parsed.city,
                intents: parsed.intents,
                nearMe: parsed.nearMe,
                llm: Boolean(parsed.llm),
            },
            results,
        },
        message: results.length
            ? `Found ${results.length} places (${source || 'live'}).`
            : 'No places found — try another city or vibe.',
    });
};

/**
 * POST /api/explore/chat
 * Multi-turn: { sessionId?, message, lat?, lng?, limit? }
 */
export const chatExplore = async (req, res) => {
    const { sessionId, message, lat, lng, limit } = req.body || {};
    const text = String(message || '').trim();
    if (!text) throw new AppError('Send a chat message.', 400);

    const session = getOrCreateExploreSession(sessionId);
    appendExploreMessage(session, { role: 'user', content: text });

    const plan = await planExploreChatTurn({
        history: session.messages,
        userMessage: text,
        lastPlaces: session.places,
    });

    let places = session.places || [];
    let center = session.center;
    let source = session.source;
    let intent = session.intent;
    let providers = {};

    if (plan.shouldSearch) {
        const searchQ = plan.searchQuery || text;
        const found = await searchExplorePlaces(searchQ, {
            limit: limit || 5,
            lat,
            lng,
        });
        places = found.results || [];
        // enrich again with full chat history for bestFor labels
        places = await enrichPlaceReasons(text, places, session.messages);
        center = found.center;
        source = found.source;
        intent = {
            city: found.parsed?.city || plan.city,
            intents: found.parsed?.intents?.length ? found.parsed.intents : plan.intents,
            nearMe: found.parsed?.nearMe || plan.nearMe,
            llm: Boolean(found.parsed?.llm || plan.llm),
        };
        providers = found.providers || {};
        updateExploreSessionSearch(session, { places, center, intent, source });
    } else if (places.length) {
        places = await enrichPlaceReasons(text, places, session.messages);
        updateExploreSessionSearch(session, { places, center, intent, source });
    }

    const assistantContent = plan.assistantMessage
        || (places.length
            ? `Here are ${places.length} places that fit. Check ratings, photos, and “best for” on each card.`
            : 'I could not find places for that — try a city name or a clearer vibe.');

    appendExploreMessage(session, {
        role: 'assistant',
        content: assistantContent,
        places: plan.shouldSearch ? places : undefined,
    });

    res.json({
        success: true,
        data: {
            session: publicSession(session),
            places,
            center,
            intent,
            source,
            providers,
            reply: assistantContent,
        },
        message: assistantContent,
    });
};

// POST /api/explore/chat/clear
export const clearExploreChat = async (req, res) => {
    const { sessionId } = req.body || {};
    const session = clearExploreSession(sessionId);
    res.json({
        success: true,
        data: { session: publicSession(session) },
        message: 'Chat cleared.',
    });
};

// GET /api/explore/chat/:sessionId
export const getExploreChat = async (req, res) => {
    const session = getOrCreateExploreSession(req.params.sessionId);
    res.json({ success: true, data: { session: publicSession(session) } });
};

// GET /api/explore/examples
export const getExploreExamples = async (_req, res) => {
    res.json({
        success: true,
        data: [
            'quiet romantic drinks in Bangalore',
            'make it cheaper and closer to Indiranagar',
            'coffee cafes near Koramangala Bangalore',
            'beach in Goa for a relaxed afternoon',
            'family-friendly parks in Delhi',
        ],
    });
};

// GET /api/explore/status
export const getExploreStatus = async (_req, res) => {
    res.json({
        success: true,
        data: {
            openai: isOpenAiConfigured(),
            googlePlaces: isGooglePlacesConfigured(),
            mapsHint: 'Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env for the map UI',
            chat: true,
            planner: true,
        },
    });
};
