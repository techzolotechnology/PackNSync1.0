export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

/** Tokens belong to this app instance. A signed-out request cannot resurrect a session. */
export function createClient({ baseUrl, storage, fetcher = (...args) => fetch(...args), onSessionEnd = () => {} }) {
  let access = null;
  let refresh = null;
  let epoch = 0;
  let renewing = null;
  let storageQueue = Promise.resolve();
  const persist = (value) => {
    storageQueue = storageQueue.catch(() => {}).then(() => storage.save(value));
    return storageQueue;
  };
  async function raw(path, { method = 'GET', body, form } = {}, sentToken = access) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), form ? 90000 : 30000);
    let response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method, signal: controller.signal, credentials: 'omit',
        headers: { Accept: 'application/json', ...(!form && body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}) },
        body: form ? form() : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new ApiError(error.name === 'AbortError' ? 'The connection timed out. Please try again.' : 'Cannot reach PickAndSync. Check your connection and try again.');
    } finally { clearTimeout(timer); }
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) throw new ApiError(json.message || `Request failed (${response.status}).`, response.status);
    return json;
  }
  function renew() {
    if (renewing) return renewing;
    const generation = epoch;
    const saved = refresh;
    const task = (async () => {
      try {
        if (!saved) throw new ApiError('Please sign in again.', 401);
        const result = await raw('/auth/refresh', { method: 'POST', body: { refreshToken: saved } }, null);
        if (generation !== epoch) throw new ApiError('Your session changed. Please try again.', 401);
        if (!result.accessToken || !result.refreshToken) throw new ApiError('Please sign in again.', 401);
        access = result.accessToken;
        refresh = result.refreshToken;
        await persist(refresh);
      } catch (error) {
        if (generation === epoch && (error.status === 401 || error.status === 403)) {
          epoch += 1; access = null; refresh = null;
          await persist(null);
          onSessionEnd();
        }
        throw error;
      }
    })();
    renewing = task;
    task.finally(() => { if (renewing === task) renewing = null; }).catch(() => {});
    return task;
  }
  async function request(path, options) {
    const generation = epoch;
    const sentToken = access;
    try {
      const result = await raw(path, options, sentToken);
      if (generation !== epoch) throw new ApiError('Your session changed. Please try again.', 401);
      return result;
    } catch (error) {
      if (generation !== epoch || error.status !== 401 || path.startsWith('/auth/') && path !== '/auth/me' || !refresh) throw error;
      if (access === sentToken) await renew();
      if (generation !== epoch) throw new ApiError('Please sign in again.', 401);
      const result = await raw(path, options);
      if (generation !== epoch) throw new ApiError('Your session changed. Please try again.', 401);
      return result;
    }
  }
  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    upload: (path, form) => request(path, { method: 'POST', form }),
    signIn: async ({ accessToken, refreshToken }) => {
      epoch += 1; renewing = null; access = accessToken; refresh = refreshToken;
      await persist(refresh);
    },
    restore: async () => {
      const generation = epoch;
      const saved = await storage.load();
      if (generation !== epoch) throw new ApiError('Your session changed. Please try again.', 401);
      refresh = saved;
      if (!refresh) return null;
      await renew();
      return (await request('/auth/me')).user;
    },
    signOut: async () => {
      const previousAccess = access;
      epoch += 1; access = null; refresh = null; renewing = null;
      await persist(null);
      onSessionEnd();
      // Local sign-out finishes even when the network is unavailable.
      if (previousAccess) raw('/auth/logout', { method: 'POST', body: {} }, previousAccess).catch(() => {});
    },
  };
}
