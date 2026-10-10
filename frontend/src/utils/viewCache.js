/**
 * Last results of list pages for this tab session, so returning to a page
 * (Back/Forward or a nav link) shows what the reader saw before — same height,
 * no skeleton — while fresh data loads quietly in the background.
 * Memory only: a reload starts clean.
 */
const MAX_ENTRIES = 30;
const store = new Map();

export function viewCacheKey(page, params) {
    return `${page}:${JSON.stringify(params)}`;
}

export function readViewCache(key) {
    return store.get(key);
}

export function writeViewCache(key, value) {
    store.delete(key);
    store.set(key, value);
    if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
}

export function clearViewCache() {
    store.clear();
}
