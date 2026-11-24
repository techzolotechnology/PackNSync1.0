// Provider cards are temporary. Persist chat text and the Maps link separately.
const results = new Map();
const MAX_SESSIONS = 100;
const TTL_MS = 30 * 60_000;

export function getExploreResults(id) {
    const cached = results.get(id);
    if (!cached) return undefined;
    if (cached.expiresAt > Date.now()) return cached.result;
    results.delete(id);
    return undefined;
}

export function cacheExploreResults(id, result) {
    results.delete(id);
    if (!result.places.length) return;
    if (results.size >= MAX_SESSIONS) results.delete(results.keys().next().value);
    results.set(id, { result, expiresAt: Date.now() + TTL_MS });
}
