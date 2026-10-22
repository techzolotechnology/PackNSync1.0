import { describe, it, expect, vi } from 'vitest';
import { createClient } from './client';

const response = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
function setup(fetcher, saved = 'saved-refresh') {
  const storage = { load: vi.fn(async () => saved), save: vi.fn(async () => {}) };
  const ended = vi.fn();
  const api = createClient({ baseUrl: 'https://example.test/api', storage, fetcher, onSessionEnd: ended });
  return { api, storage, ended };
}

describe('host session lifecycle', () => {
  it('restores with a body refresh token and never browser cookies', async () => {
    const fetcher = vi.fn(async (url) => url.endsWith('/auth/refresh') ? response(200, { accessToken: 'new-access', refreshToken: 'rotated' }) : response(200, { user: { id: 'host' } }));
    const { api, storage } = setup(fetcher);
    expect(await api.restore()).toEqual({ id: 'host' });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ refreshToken: 'saved-refresh' });
    expect(fetcher.mock.calls[0][1].credentials).toBe('omit');
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer new-access');
    expect(storage.save).toHaveBeenCalledWith('rotated');
  });
  it('shares one token rotation between parallel unauthorized requests', async () => {
    const gate = deferred();
    const fetcher = vi.fn(async (url, options) => {
      if (url.endsWith('/auth/refresh')) { await gate.promise; return response(200, { accessToken: 'new', refreshToken: 'r2' }); }
      return options.headers.Authorization === 'Bearer new' ? response(200, { data: [] }) : response(401);
    });
    const { api } = setup(fetcher);
    await api.signIn({ accessToken: 'old', refreshToken: 'r1' });
    const a = api.get('/vehicles/my'); const b = api.get('/rentals/bookings/host');
    await vi.waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1));
    gate.resolve(); await Promise.all([a, b]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  });
  it('does not destroy saved authentication on a temporary service error', async () => {
    const { api, storage, ended } = setup(async () => response(503, { message: 'Unavailable' }));
    await expect(api.restore()).rejects.toMatchObject({ status: 503 });
    expect(storage.save).not.toHaveBeenCalledWith(null);
    expect(ended).not.toHaveBeenCalled();
  });
  it('removes an invalid saved session and notifies the UI', async () => {
    const { api, storage, ended } = setup(async () => response(401));
    await expect(api.restore()).rejects.toMatchObject({ status: 401 });
    expect(storage.save).toHaveBeenLastCalledWith(null);
    expect(ended).toHaveBeenCalledOnce();
  });
  it('never revives a session after sign-out during a refresh', async () => {
    const gate = deferred();
    const fetcher = vi.fn(async (url) => url.endsWith('/auth/refresh') ? gate.promise : response(401));
    const { api, storage } = setup(fetcher);
    await api.signIn({ accessToken: 'old', refreshToken: 'r1' });
    const pending = api.get('/vehicles/my');
    const rejection = expect(pending).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.endsWith('/auth/refresh'))).toBe(true));
    await api.signOut();
    gate.resolve(response(200, { accessToken: 'late', refreshToken: 'late-refresh' }));
    await rejection;
    expect(storage.save).toHaveBeenLastCalledWith(null);
    expect(storage.save).not.toHaveBeenCalledWith('late-refresh');
  });
  it('does not rotate authentication after an incorrect OTP', async () => {
    const fetcher = vi.fn(async () => response(401, { message: 'Incorrect code' }));
    const { api } = setup(fetcher);
    await api.signIn({ accessToken: 'existing', refreshToken: 'r1' });
    await expect(api.post('/auth/verify-otp', { otpCode: '123456' })).rejects.toThrow('Incorrect code');
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('does not repeat a withdrawal on a lost connection', async () => {
    const fetcher = vi.fn(async () => { throw new TypeError('offline'); });
    const { api } = setup(fetcher);
    await expect(api.post('/wallet/withdraw', { amount: 500 })).rejects.toMatchObject({ status: 0 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('cannot restore an old account after sign-out while secure storage was loading', async () => {
    const gate = deferred();
    const fetcher = vi.fn();
    const storage = { load: () => gate.promise, save: vi.fn(async () => {}) };
    const api = createClient({ baseUrl: 'https://example.test/api', storage, fetcher });
    const pending = api.restore();
    const rejection = expect(pending).rejects.toMatchObject({ status: 401 });
    await api.signOut();
    gate.resolve('old-account-token');
    await rejection;
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('lets fetch set the multipart boundary and rebuilds the form after refresh', async () => {
    const forms = [];
    const fetcher = vi.fn(async (url, options) => {
      if (url.endsWith('/auth/refresh')) return response(200, { accessToken: 'new', refreshToken: 'r2' });
      forms.push(options.body);
      expect(options.headers['Content-Type']).toBeUndefined();
      return forms.length === 1 ? response(401) : response(200, { data: { url: '/photo.jpg' } });
    });
    const { api } = setup(fetcher);
    await api.signIn({ accessToken: 'old', refreshToken: 'r1' });
    await api.upload('/vehicles/upload-image', () => ({ marker: Math.random() }));
    expect(forms).toHaveLength(2);
    expect(forms[0]).not.toBe(forms[1]);
  });
});
