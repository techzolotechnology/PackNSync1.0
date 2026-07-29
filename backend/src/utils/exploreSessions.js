import { randomUUID } from 'crypto';

/** In-memory Explore chat sessions (per server process). */
const sessions = new Map();
const MAX_MESSAGES = 40;
const TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

const touch = (session) => {
    session.updatedAt = Date.now();
    return session;
};

export const createExploreSession = () => {
    const id = randomUUID();
    const session = touch({
        id,
        messages: [],
        places: [],
        center: null,
        intent: null,
        source: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    sessions.set(id, session);
    return session;
};

export const getExploreSession = (id) => {
    if (!id) return null;
    const session = sessions.get(id);
    if (!session) return null;
    if (Date.now() - session.updatedAt > TTL_MS) {
        sessions.delete(id);
        return null;
    }
    return session;
};

export const getOrCreateExploreSession = (id) => {
    const existing = getExploreSession(id);
    if (existing) return existing;
    return createExploreSession();
};

export const appendExploreMessage = (session, message) => {
    session.messages.push({
        id: randomUUID(),
        role: message.role,
        content: message.content,
        places: message.places || undefined,
        createdAt: new Date().toISOString(),
    });
    if (session.messages.length > MAX_MESSAGES) {
        session.messages = session.messages.slice(-MAX_MESSAGES);
    }
    return touch(session);
};

export const updateExploreSessionSearch = (session, { places, center, intent, source }) => {
    session.places = places || [];
    session.center = center || null;
    session.intent = intent || null;
    session.source = source || null;
    return touch(session);
};

export const clearExploreSession = (id) => {
    if (id && sessions.has(id)) sessions.delete(id);
    return createExploreSession();
};

export const publicSession = (session) => ({
    id: session.id,
    messages: session.messages,
    places: session.places,
    center: session.center,
    intent: session.intent,
    source: session.source,
});
