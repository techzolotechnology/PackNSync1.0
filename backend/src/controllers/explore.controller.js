import { AppError } from '../utils/AppError.js';
import { buildExploreFollowUp, parseExploreQuery, searchExplorePlaces } from '../utils/exploreSearch.js';
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

function placeSearchReply(found) {
    const { results, parsed, lookupUnavailable, needsLocation } = found;
    if (results.length) {
        return `Found ${results.length} ${results.length === 1 ? 'place' : 'places'}${parsed.city ? ` around ${parsed.city}` : ''}. Tap a card to see its location.`;
    }
    if (needsLocation) return 'Which city or neighbourhood should I search? You can also share your location for nearby results.';
    if (lookupUnavailable) return 'Live place results are temporarily unavailable. Open this search in Google Maps to compare places, prices, and opening hours.';
    return 'I didn’t find a matching place. Try a nearby city or open the same search in Google Maps.';
}

// POST /api/explore/search — one-shot (still supported)
export const searchExplore = async (req, res) => {
    const { query, limit, lat, lng } = req.body || {};
    if (typeof query !== 'string' || !query.trim()) {
        throw new AppError('Enter a place query, e.g. “quiet romantic drinks in Bangalore”.', 400);
    }

    const found = await searchExplorePlaces(query.trim().slice(0, 500), {
        limit: limit || 5,
        lat,
        lng,
    });

    const { parsed, results, center, source, providers, fallbackUrl } = found;
    res.json({
        success: true,
        data: {
            query: parsed.raw,
            fallbackUrl,
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
        message: placeSearchReply(found),
    });
};

/**
 * POST /api/explore/chat
 * Multi-turn: { sessionId?, message, lat?, lng?, limit? }
 */
export const chatExplore = async (req, res) => {
    const { sessionId, message, lat, lng, limit } = req.body || {};
    const text = typeof message === 'string' ? message.trim().slice(0, 500) : '';
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
    let fallbackUrl;
    let reply;
    const contextualQuery = buildExploreFollowUp(text, session.lastSearchQuery);
    const useContext = contextualQuery !== text || Boolean(parseExploreQuery(text).geocodeQuery);
    const shouldSearch = plan.shouldSearch || useContext || !places.length;

    if (shouldSearch) {
        const searchQ = useContext ? contextualQuery : plan.searchQuery || contextualQuery;
        session.lastSearchQuery = searchQ;
        const found = await searchExplorePlaces(searchQ, {
            limit: limit || 5,
            lat,
            lng,
            history: session.messages,
        });
        places = found.results || [];
        fallbackUrl = found.needsLocation ? undefined : found.fallbackUrl;
        reply = placeSearchReply(found);
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

    const assistantContent = reply || plan.assistantMessage
        || (places.length
            ? `Here are ${places.length} places that fit. Check ratings, photos, and “best for” on each card.`
            : 'I could not find places for that — try a city name or a clearer vibe.');

    appendExploreMessage(session, {
        role: 'assistant',
        content: assistantContent,
        places: shouldSearch ? places : undefined,
        fallbackUrl,
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
            fallbackUrl,
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
