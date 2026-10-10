// Run from this folder:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { isLinkPreviewBot } from '../src/index.js';

const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const WHATSAPP = 'WhatsApp/2.23.20.0 A';
const ctx = { waitUntil() {} };
const env = { SITE_URL: 'https://pickandsync.com', API_URL: 'https://api.pickandsync.com' };

function withFetch(impl, run) {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push(String(url)); return impl(url, init); };
    return run(calls).finally(() => { globalThis.fetch = original; });
}

const get = (path, ua) => new Request(`https://go.pickandsync.com${path}`, { headers: ua ? { 'user-agent': ua } : {} });

test('people are redirected to the trip page without calling the API', () => withFetch(
    () => { throw new Error('API must not be called'); },
    async (calls) => {
        const res = await worker.fetch(get('/t/97c87b23-29b1?invite=ABC23', PHONE), env, ctx);
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), 'https://pickandsync.com/trips/97c87b23-29b1?invite=ABC23');
        assert.equal(calls.length, 0);
    },
));

test('preview bots get the API preview page', () => withFetch(
    () => new Response('<meta property="og:title" content="Coorg weekend" />', { status: 200 }),
    async (calls) => {
        const res = await worker.fetch(get('/t/t1?invite=ABC23', WHATSAPP), env, ctx);
        assert.equal(res.status, 200);
        assert.match(await res.text(), /Coorg weekend/);
        assert.deepEqual(calls, ['https://api.pickandsync.com/share/trips/t1?invite=ABC23']);
    },
));

test('bots still get a preview when the API fails', () => withFetch(
    () => new Response('down', { status: 503 }),
    async () => {
        const res = await worker.fetch(get('/t/t1', WHATSAPP), env, ctx);
        assert.equal(res.status, 200);
        const html = await res.text();
        assert.match(html, /Join a trip on PickAndSync/);
        assert.match(html, /url=https:\/\/pickandsync\.com\/trips\/t1/);
    },
));

test('anything else goes to the home page', async () => {
    for (const path of ['/', '/t/', '/t/../../admin', '/random']) {
        const res = await worker.fetch(get(path, PHONE), env, ctx);
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), 'https://pickandsync.com/');
    }
});

test('the cron trigger pings the API health check', () => withFetch(
    () => new Response('{"status":"ok"}'),
    async (calls) => {
        const pending = [];
        await worker.scheduled({}, env, { waitUntil: (p) => pending.push(p) });
        await Promise.all(pending);
        assert.deepEqual(calls, ['https://api.pickandsync.com/health']);
    },
));

test('bot detection matches the backend rules', () => {
    assert.equal(isLinkPreviewBot(WHATSAPP), true);
    assert.equal(isLinkPreviewBot('TelegramBot (like TwitterBot)'), true);
    assert.equal(isLinkPreviewBot(''), true);
    assert.equal(isLinkPreviewBot(PHONE), false);
});
