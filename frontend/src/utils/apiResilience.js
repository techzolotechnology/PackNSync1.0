/**
 * Transient browser/network failures (Wi‑Fi flip, VPN, ERR_NETWORK_CHANGED).
 * Do NOT treat HTTP 4xx/5xx as transient — those are real API answers
 * (and register may have already created the user before a 502).
 */
export function isTransientNetworkError(err) {
    if (!err || err.response) return false;
    const code = String(err.code || '');
    const msg = String(err.message || '').toLowerCase();
    return (
        code === 'ECONNABORTED'
        || code === 'ERR_NETWORK'
        || code === 'ERR_NETWORK_CHANGED'
        || code === 'ECONNRESET'
        || code === 'ETIMEDOUT'
        || msg.includes('network error')
        || msg.includes('network changed')
        || msg.includes('timeout')
        || msg.includes('failed to fetch')
    );
}

export async function withNetworkRetry(fn, { retries = 2, delayMs = 900 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (!isTransientNetworkError(err) || attempt === retries) throw err;
            await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        }
    }
    throw lastErr;
}

/** Ping Render health so cold starts begin before the user hits Get OTP. */
export function wakeApi() {
    const base = (import.meta.env.VITE_SOCKET_URL || '').replace(/\/$/, '');
    if (!base || base.includes('localhost') || base.includes('127.0.0.1')) return;
    fetch(`${base}/health`, { method: 'GET', mode: 'cors', cache: 'no-store' }).catch(() => {});
}
