import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExploreChatReply, searchExplore } from '../controllers/explore.controller.js';
import { buildExploreFollowUp, parseExploreQuery } from './exploreSearch.js';

async function request(handler, body) {
    const res = { json: vi.fn() };
    await handler({ body }, res);
    return res.json.mock.calls[0][0];
}

const googleQuery = (url, options) => options?.body
    ? JSON.parse(options.body).textQuery
    : new URL(url).searchParams.get('query');

describe('Explore Place Chat', () => {
    beforeEach(() => {
        vi.stubEnv('OPENAI_API_KEY', '');
        vi.stubEnv('GOOGLE_PLACES_API_KEY', 'fixture-google-places-key');
        vi.stubEnv('EXPLORE_DEFAULT_CENTER', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('keeps the topic and applies the follow-up budget and neighbourhood', () => {
        const query = buildExploreFollowUp('make it cheaper and closer to Indiranagar', 'quiet romantic drinks in Bangalore');
        expect(query).toBe('budget quiet romantic drinks in Indiranagar, Bengaluru, India');
        expect(parseExploreQuery('quite romantic drink in haryana')).toMatchObject({
            city: 'haryana', intents: ['romantic', 'quiet', 'drinks'],
        });
    });

    it('returns real provider cards when only Places API (New) is available, using the requested area over GPS', async () => {
        const fetch = vi.fn(async (url, options) => {
            if (new URL(url).hostname === 'maps.googleapis.com') {
                expect(new URL(url).searchParams.has('location')).toBe(false);
                return Response.json({ status: 'REQUEST_DENIED' });
            }
            expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
            expect(googleQuery(url, options)).toBe('quiet romantic drink in haryana');
            expect(JSON.parse(options.body).locationBias).toBeUndefined();
            return Response.json({
                places: [{
                    id: 'sample', displayName: { text: 'Example cafe' }, formattedAddress: 'Gurugram, Haryana',
                    location: { latitude: 28.46, longitude: 77.03 }, types: ['cafe'],
                    priceLevel: 'PRICE_LEVEL_INEXPENSIVE', rating: 4.3,
                }],
            });
        });
        vi.stubGlobal('fetch', fetch);
        const reply = await buildExploreChatReply({ messages: [] }, { message: 'quite romantic drink in haryana', lat: 12.9, lng: 77.6 });
        expect(reply).toMatchObject({ source: 'google_places', places: [{ name: 'Example cafe', priceLevel: 1 }] });
        expect(reply.reply).toMatch(/Found 1 place.*haryana/i);
        expect(reply.fallbackUrl).toBeUndefined();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('keeps a usable chat and map link when upstream lookups fail, including the next turn', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));

        const first = await buildExploreChatReply({ messages: [] }, { message: 'quiet romantic drinks in Bangalore' });
        expect(first).toMatchObject({ places: [], source: 'maps_link' });
        expect(first.reply).toMatch(/temporarily unavailable/);

        const second = await buildExploreChatReply({ messages: [{ role: 'assistant', content: first.reply }], searchQuery: first.searchQuery }, { message: 'make it cheaper and closer to Indiranagar' });
        const url = new URL(second.fallbackUrl);
        expect(url.hostname).toBe('www.google.com');
        expect(url.searchParams.get('query')).toBe('budget quiet romantic drinks in Indiranagar, Bengaluru, India');

        const oneShot = await request(searchExplore, { query: 'coffee near Koramangala Bangalore' });
        expect(oneShot.data.fallbackUrl).toContain('maps/search');
    });
});
