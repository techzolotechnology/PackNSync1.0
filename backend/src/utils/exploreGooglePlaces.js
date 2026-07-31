/**
 * Google Places (legacy Text Search + details fields).
 * Uses GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY from backend/.env
 */

export const getGooglePlacesKey = () => {
    const key = (
        process.env.GOOGLE_PLACES_API_KEY
        || process.env.GOOGLE_MAPS_API_KEY
        || ''
    ).trim();
    if (!key || key.includes('your_')) return null;
    return key;
};

export const isGooglePlacesConfigured = () => Boolean(getGooglePlacesKey());

/**
 * Country the app serves. Without this bias a query like "quiet romantic drink"
 * (no city named) comes back US-centric from Google.
 */
export const getExploreRegion = () => (process.env.EXPLORE_REGION || 'in').trim().toLowerCase();

/**
 * Optional "home city" bias, as "lat,lng" in EXPLORE_DEFAULT_CENTER.
 * Returns null when unset, in which case only the country bias applies.
 */
export const getExploreDefaultCenter = () => {
    const raw = (process.env.EXPLORE_DEFAULT_CENTER || '').trim();
    if (!raw) return null;
    const [lat, lng] = raw.split(',').map((n) => Number(n.trim()));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
        lat,
        lng,
        label: (process.env.EXPLORE_DEFAULT_CENTER_LABEL || '').trim() || 'Default area',
        city: null,
    };
};

const typeForIntents = (intents = []) => {
    if (intents.includes('coffee')) return 'cafe';
    if (intents.includes('drinks')) return 'bar';
    if (intents.includes('food')) return 'restaurant';
    if (intents.includes('outdoors')) return 'park';
    if (intents.includes('beach')) return 'tourist_attraction';
    return undefined;
};

/**
 * Text Search — best for "romantic drinks in Bangalore"
 */
export async function googlePlacesTextSearch({
    query,
    lat = null,
    lng = null,
    intents = [],
    limit = 8,
    radiusMeters = 8000,
}) {
    const key = getGooglePlacesKey();
    if (!key) return null;

    const params = new URLSearchParams({
        query,
        key,
        region: getExploreRegion(),
    });

    if (lat != null && lng != null) {
        params.set('location', `${lat},${lng}`);
        params.set('radius', String(radiusMeters));
    }

    const type = typeForIntents(intents);
    if (type) params.set('type', type);

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.warn('[Google Places]', data.status, data.error_message || '');
        throw new Error(data.error_message || `Google Places status: ${data.status}`);
    }

    const results = Array.isArray(data.results) ? data.results : [];
    return results.slice(0, limit).map((r) => ({
        id: `gplace-${r.place_id}`,
        placeId: r.place_id,
        name: r.name,
        address: r.formatted_address || r.vicinity || '',
        city: '',
        lat: r.geometry?.location?.lat,
        lng: r.geometry?.location?.lng,
        categories: r.types || [],
        priceLevel: r.price_level ?? null,
        rating: r.rating ?? null,
        userRatingsTotal: r.user_ratings_total ?? null,
        vibeTags: (r.types || []).slice(0, 5),
        hours: r.opening_hours?.open_now != null
            ? (r.opening_hours.open_now ? 'Open now' : 'Closed now')
            : null,
        summary: r.types?.[0]?.replace(/_/g, ' ') || 'Google Place',
        source: 'google_places',
        photoRef: r.photos?.[0]?.photo_reference || null,
    })).filter((p) => p.lat != null && p.lng != null);
}

export function googlePhotoUrl(photoRef, { maxwidth = 400 } = {}) {
    const key = getGooglePlacesKey();
    if (!key || !photoRef) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(photoRef)}&key=${key}`;
}
