import { AppError } from '../utils/AppError.js';
import { buildExploreFollowUp, parseExploreQuery, searchExplorePlaces } from '../utils/exploreSearch.js';
import {
    enrichPlaceReasons,
    isOpenAiConfigured,
    planExploreChatTurn,
} from '../utils/exploreLlm.js';
import { isGooglePlacesConfigured } from '../utils/exploreGooglePlaces.js';
import { prisma } from '../utils/prisma.js';
import { cacheExploreResults, getExploreResults } from '../utils/exploreSessions.js';
import {
    aiIdentity, aiQuota, chatContact, publicAiChat, aiChatMessage,
    reserveAiTurn, finishAiTurn, releaseAiTurn,
} from '../utils/exploreAiChat.js';

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

export async function buildExploreChatReply(session, { message, lat, lng, limit }, previous) {
    const history = [...session.messages.slice(-11), { role: 'user', content: message }];
    const plan = await planExploreChatTurn({ history, userMessage: message, lastPlaces: previous?.places });
    const contextualQuery = buildExploreFollowUp(message, session.searchQuery);
    const useContext = contextualQuery !== message || Boolean(parseExploreQuery(message).geocodeQuery);
    if (!plan.shouldSearch && !useContext && previous?.places.length) {
        const places = await enrichPlaceReasons(message, previous.places, history);
        return { ...previous, places, reply: plan.assistantMessage, fallbackUrl: undefined };
    }
    const searchQuery = useContext ? contextualQuery : plan.searchQuery || contextualQuery;
    const found = await searchExplorePlaces(searchQuery, { limit: limit || 5, lat, lng, history });
    const intent = {
        city: found.parsed?.city || plan.city || null,
        intents: found.parsed?.intents?.length ? found.parsed.intents : plan.intents || [],
        nearMe: Boolean(found.parsed?.nearMe || plan.nearMe),
        llm: Boolean(found.parsed?.llm || plan.llm),
    };
    return {
        searchQuery, intent,
        places: found.results || [], center: found.center, source: found.source, providers: found.providers || {},
        reply: placeSearchReply(found), fallbackUrl: found.needsLocation ? undefined : found.fallbackUrl,
    };
}

const KIND = 'EXPLORE';
const respond = (res, data) => res.set('Cache-Control', 'no-store').json({ success: true, data });

export const chatExplore = async (req, res) => {
    const { sessionId, message, lat, lng, limit } = req.body || {};
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text || text.length > 500) throw new AppError('Send a chat message of up to 500 characters.', 400);
    if (typeof sessionId !== 'string' || !sessionId) throw new AppError('Start your chat first.', 400);
    const identity = await aiIdentity(req, res);
    const turn = await reserveAiTurn(identity, sessionId, KIND);
    let answer;
    let chat;
    try {
        answer = await buildExploreChatReply(turn, { message: text, lat, lng, limit }, getExploreResults(turn.id));
        chat = await finishAiTurn(turn, [
            aiChatMessage('user', text),
            aiChatMessage('assistant', answer.reply, answer.fallbackUrl),
        ], { searchQuery: answer.searchQuery, searchIntent: answer.intent });
    } catch (error) {
        await releaseAiTurn(turn);
        throw error;
    }
    cacheExploreResults(turn.id, answer);
    const { places, center, intent, source, providers, reply, fallbackUrl } = answer;
    return respond(res, { places, center, intent, source, providers, reply, fallbackUrl, session: publicAiChat(chat), quota: await aiQuota(identity) });
};

export const startExploreChat = async (req, res) => {
    const contact = chatContact(req.body);
    const identity = await aiIdentity(req, res);
    const session = await prisma.exploreAiChat.create({
        data: { kind: KIND, ownerKey: identity.ownerKey, userId: identity.userId, ...contact },
    });
    return respond(res, { session: publicAiChat(session), quota: await aiQuota(identity) });
};

export const getCurrentExploreChat = async (req, res) => {
    const identity = await aiIdentity(req, res);
    const session = identity.userId ? await prisma.exploreAiChat.findFirst({
        where: { ownerKey: identity.ownerKey, kind: KIND }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }) : null;
    return respond(res, { session: publicAiChat(session), quota: await aiQuota(identity) });
};

export const getExploreChat = async (req, res) => {
    const identity = await aiIdentity(req, res);
    const session = await prisma.exploreAiChat.findFirst({
        where: { id: req.params.sessionId, ownerKey: identity.ownerKey, kind: KIND },
    });
    if (!session) throw new AppError('Chat not found.', 404);
    return respond(res, { session: publicAiChat(session), quota: await aiQuota(identity) });
};

export const clearExploreChat = async (req, res) => {
    const identity = await aiIdentity(req, res);
    const sessionId = req.body?.sessionId;
    if (typeof sessionId !== 'string' || !sessionId) throw new AppError('Chat not found.', 404);
    const previous = await prisma.exploreAiChat.findFirst({
        where: { id: sessionId, ownerKey: identity.ownerKey, kind: KIND },
        select: { displayName: true, phoneNumber: true },
    });
    if (!previous) throw new AppError('Chat not found.', 404);
    const session = await prisma.exploreAiChat.create({
        data: { kind: KIND, ownerKey: identity.ownerKey, userId: identity.userId, ...previous },
    });
    return respond(res, { session: publicAiChat(session), quota: await aiQuota(identity) });
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
