const KEY = 'pns.referral';
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // a referral link counts for 60 days

/** Remember a ?ref= code so it can be attached when the visitor registers. */
export function rememberReferral(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(clean)) return;
    try {
        localStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() }));
    } catch { /* storage blocked */ }
}

export function storedReferral() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (!raw?.code || Date.now() - raw.at > MAX_AGE_MS) return null;
        return raw.code;
    } catch {
        return null;
    }
}
