import { API_BASE_URL } from './backendConfig';

let token = null;
const baseUrl = API_BASE_URL;

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || `Request failed: ${res.status}`);
  return json;
};

const requestWithRefresh = async (path, options = {}) => {
  try {
    return await request(path, options);
  } catch (error) {
    if (!String(error.message).includes('401')) throw error;
    const refreshed = await request('/auth/refresh', { method: 'POST' });
    if (refreshed.accessToken) token = refreshed.accessToken;
    return request(path, options);
  }
};

export const api = {
  setToken: (nextToken) => { token = nextToken; },
  get: (path, params) => {
    const query = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString()}` : '';
    return requestWithRefresh(`${path}${query}`);
  },
  post: (path, body) => requestWithRefresh(path, { method: 'POST', body }),
  put: (path, body) => requestWithRefresh(path, { method: 'PUT', body }),
  delete: (path) => requestWithRefresh(path, { method: 'DELETE' })
};
