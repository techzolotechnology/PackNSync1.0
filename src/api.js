import { API_BASE_URL } from './backendConfig';

let token = null;
let refreshToken = null;
const baseUrl = API_BASE_URL;
const REQUEST_TIMEOUT_MS = 90000;

// The server rotates the refresh token on every refresh; whoever stores it is told here.
let onRefreshTokenChange = () => {};
// Called when the session can no longer be renewed (signed out elsewhere, banned, expired).
let onSessionEnd = () => {};

const setRefreshToken = (next) => {
  refreshToken = next || null;
  onRefreshTokenChange(refreshToken);
};

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const method = options.method || 'GET';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      // Auth is carried in the bearer token and SecureStore refresh-token body.
      // Do not attach browser cookies to native requests; this also keeps native
      // API calls outside cookie-based CSRF handling.
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (cause) {
    const timedOut = cause?.name === 'AbortError';
    const message = timedOut
      ? (method === 'GET' || path.startsWith('/auth/')
        ? 'The server is taking longer than expected. Check your connection and try again.'
        : 'We could not confirm whether this request completed. Refresh its status before repeating it.')
      : 'Cannot connect to PickAndSync. Check your connection and try again.';
    const error = new Error(message);
    error.status = 0;
    error.code = timedOut ? 'ETIMEDOUT' : 'NETWORK_ERROR';
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const error = new Error(json.message || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return json;
};

// One refresh at a time: the server rotates the token, so a second parallel refresh would fail.
let refreshing = null;
const refreshSession = () => {
  if (!refreshing) refreshing = renewTokens().finally(() => { refreshing = null; });
  return refreshing;
};

const renewTokens = async () => {
  try {
    const refreshed = await request('/auth/refresh', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : undefined
    });
    if (refreshed.accessToken) token = refreshed.accessToken;
    if (refreshed.refreshToken) setRefreshToken(refreshed.refreshToken);
  } catch (error) {
    // Offline or a server hiccup: keep the saved session for the next try.
    if (error.status !== 401 && error.status !== 403) throw error;
    token = null;
    setRefreshToken(null);
    onSessionEnd();
    const ended = new Error('Your session ended. Please sign in again.');
    ended.status = 401;
    throw ended;
  }
};

const requestWithRefresh = async (path, options = {}) => {
  const sentWith = token;
  try {
    return await request(path, options);
  } catch (error) {
    // Refresh only on an expired/invalid access token, and never for auth calls themselves.
    if (error.status !== 401 || path.startsWith('/auth/') || !refreshToken) throw error;
    // Skip the refresh if another request already renewed the token meanwhile.
    if (token === sentWith) await refreshSession();
    return request(path, options);
  }
};

const withQuery = (path, params) => {
  if (!params) return path;
  // Built by hand: React Native's URLSearchParams only half-implements the spec.
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return query ? `${path}?${query}` : path;
};

export const api = {
  // Begin waking a possibly idle API while the app is starting. This is
  // best-effort and never delays navigation or retries a state-changing call.
  wake: async () => {
    const origin = baseUrl.replace(/\/api\/?$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${origin}/health`, {
        method: 'GET', signal: controller.signal, credentials: 'omit',
        headers: { Accept: 'application/json' },
      });
      return response.ok;
    } catch { return false; }
    finally { clearTimeout(timer); }
  },
  authorizationHeaders: () => (token ? { Authorization: `Bearer ${token}` } : {}),
  setToken: (nextToken, nextRefreshToken = null) => {
    token = nextToken;
    setRefreshToken(nextToken ? nextRefreshToken : null);
  },
  onRefreshTokenChange: (fn) => { onRefreshTokenChange = fn || (() => {}); },
  onSessionEnd: (fn) => { onSessionEnd = fn || (() => {}); },
  /** Sign back in from a saved refresh token; resolves with the user. */
  restore: async (savedRefreshToken) => {
    refreshToken = savedRefreshToken;
    await refreshSession();
    const me = await request('/auth/me');
    return me.user;
  },
  get: (path, params) => requestWithRefresh(withQuery(path, params)),
  post: (path, body) => requestWithRefresh(path, { method: 'POST', body }),
  put: (path, body) => requestWithRefresh(path, { method: 'PUT', body }),
  patch: (path, body) => requestWithRefresh(path, { method: 'PATCH', body }),
  delete: (path) => requestWithRefresh(path, { method: 'DELETE' })
};

/** ₹ with Indian digit grouping (1,23,456.5), done by hand so it never depends on the phone's locale data. */
export const rupees = (value) => {
  const n = Math.round(Number(value || 0) * 100) / 100;
  const [whole, fraction] = Math.abs(n).toFixed(2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  const cents = fraction === '00' ? '' : `.${fraction.replace(/0$/, '')}`;
  return `${n < 0 ? '−' : ''}₹${grouped}${cents}`;
};
