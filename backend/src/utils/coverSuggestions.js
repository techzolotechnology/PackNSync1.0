/**
 * Place-based cover suggestions from Openverse (real CC photos — not AI-generated).
 */

const FALLBACK_COVERS = [
    {
        id: 'fallback-1',
        url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
        thumb: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=400&q=70',
        title: 'Travel road',
        attribution: 'Stock travel photo',
    },
    {
        id: 'fallback-2',
        url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80',
        thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=70',
        title: 'Mountains',
        attribution: 'Stock travel photo',
    },
    {
        id: 'fallback-3',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        thumb: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=70',
        title: 'Coast',
        attribution: 'Stock travel photo',
    },
    {
        id: 'fallback-4',
        url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80',
        thumb: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=400&q=70',
        title: 'Lake',
        attribution: 'Stock travel photo',
    },
];

function placeQuery(place) {
    const cleaned = String(place || '')
        .replace(/,+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    // Prefer place name + travel landscape for better destination photos
    const primary = cleaned.split(/[|,]/)[0]?.trim() || cleaned;
    return `${primary} travel landscape`;
}

export async function fetchCoverSuggestions(place, limit = 4) {
    const q = placeQuery(place);
    if (!q || q.length < 3) return [];

    try {
        const url = new URL('https://api.openverse.org/v1/images/');
        url.searchParams.set('q', q);
        url.searchParams.set('page_size', String(Math.min(Math.max(limit, 4), 8)));
        url.searchParams.set('mature', 'false');

        const res = await fetch(url.toString(), {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'PackAndSync/1.0 (trip cover suggestions)',
            },
        });

        if (!res.ok) throw new Error(`Openverse ${res.status}`);

        const data = await res.json();
        const results = (data.results || [])
            .filter((img) => img?.url && !img.mature)
            .slice(0, limit)
            .map((img) => ({
                id: img.id,
                url: img.url,
                thumb: img.thumbnail || img.url,
                title: img.title || 'Cover photo',
                attribution: img.attribution || (img.creator ? `Photo by ${img.creator}` : 'Openverse'),
            }));

        if (results.length >= 2) return results;
    } catch (err) {
        console.warn('[coverSuggestions]', err.message);
    }

    // Deterministic fallback so create flow still works offline
    const seed = [...String(place)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return FALLBACK_COVERS.map((img, i) => FALLBACK_COVERS[(seed + i) % FALLBACK_COVERS.length])
        .filter((img, i, arr) => arr.findIndex((x) => x.id === img.id) === i)
        .slice(0, limit);
}
