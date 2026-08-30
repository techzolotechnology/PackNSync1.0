import { AppError } from './AppError.js';
import { enrichPlaceReasons, refineExploreIntent } from './exploreLlm.js';
import {
    getExploreDefaultCenter,
    googlePhotoUrl,
    googlePlacesTextSearch,
    isGooglePlacesConfigured,
} from './exploreGooglePlaces.js';

const USER_AGENT = 'PickAndSync/1.0 (explore; contact=dev@packandsync.local)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

/** Country we geocode bare place names against. */
export const DEFAULT_COUNTRY = (process.env.EXPLORE_COUNTRY || 'India').trim();

const CITY_ALIASES = {
    bangalore: 'Bengaluru, India',
    bengaluru: 'Bengaluru, India',
    blr: 'Bengaluru, India',
    mumbai: 'Mumbai, India',
    bombay: 'Mumbai, India',
    goa: 'Goa, India',
    delhi: 'New Delhi, India',
    'new delhi': 'New Delhi, India',
    jaipur: 'Jaipur, India',
    hyderabad: 'Hyderabad, India',
    chennai: 'Chennai, India',
    pune: 'Pune, India',
    kolkata: 'Kolkata, India',
    kochi: 'Kochi, India',
    cochin: 'Kochi, India',
};

const INTENT_KEYWORDS = {
    romantic: ['romantic', 'date', 'intimate', 'couple', 'anniversary'],
    quiet: ['quiet', 'calm', 'peaceful', 'soft', 'dim', 'chill'],
    drinks: ['drinks', 'cocktail', 'bar', 'wine', 'beer', 'nightlife', 'pub'],
    coffee: ['coffee', 'cafe', 'café', 'brunch', 'latte', 'espresso'],
    food: ['food', 'eat', 'dinner', 'lunch', 'hungry', 'restaurant', 'biryani'],
    beach: ['beach', 'sea', 'coast', 'waves'],
    outdoors: ['outdoors', 'walk', 'park', 'hike', 'sunrise', 'sunset', 'views', 'garden'],
    budget: ['budget', 'cheap', 'affordable', 'inexpensive'],
    family: ['family', 'kids', 'parents'],
    friends: ['friends', 'group', 'crew', 'gang'],
    local: ['local', 'authentic', 'locals'],
};

/** OSM filters per intent — real map features only */
const INTENT_OSM = {
    drinks: [
        'node["amenity"="bar"]',
        'node["amenity"="pub"]',
        'node["amenity"="biergarten"]',
        'way["amenity"="bar"]',
        'way["amenity"="pub"]',
    ],
    coffee: [
        'node["amenity"="cafe"]',
        'way["amenity"="cafe"]',
        'node["cuisine"="coffee_shop"]',
    ],
    food: [
        'node["amenity"="restaurant"]',
        'node["amenity"="fast_food"]',
        'way["amenity"="restaurant"]',
    ],
    beach: [
        'node["natural"="beach"]',
        'way["natural"="beach"]',
        'node["leisure"="beach_resort"]',
    ],
    outdoors: [
        'node["leisure"="park"]',
        'way["leisure"="park"]',
        'node["leisure"="garden"]',
        'node["tourism"="viewpoint"]',
        'way["tourism"="viewpoint"]',
    ],
    romantic: [
        'node["amenity"="restaurant"]',
        'node["amenity"="bar"]',
        'node["amenity"="cafe"]',
        'way["amenity"="restaurant"]',
    ],
    quiet: [
        'node["leisure"="park"]',
        'node["amenity"="cafe"]',
        'node["amenity"="library"]',
        'way["leisure"="park"]',
    ],
    family: [
        'node["leisure"="park"]',
        'node["tourism"="zoo"]',
        'node["amenity"="cafe"]',
        'way["leisure"="park"]',
    ],
    default: [
        'node["amenity"="cafe"]',
        'node["amenity"="restaurant"]',
        'node["amenity"="bar"]',
        'node["leisure"="park"]',
        'way["amenity"="cafe"]',
        'way["amenity"="restaurant"]',
    ],
};

export const parseExploreQuery = (raw = '') => {
    const text = String(raw).trim();
    const lower = text.toLowerCase();
    const intents = [];
    for (const [intent, words] of Object.entries(INTENT_KEYWORDS)) {
        if (words.some((w) => lower.includes(w))) intents.push(intent);
    }

    let city = null;
    let geocodeQuery = null;
    for (const [alias, name] of Object.entries(CITY_ALIASES)) {
        if (lower.includes(alias)) {
            city = alias;
            geocodeQuery = name;
            break;
        }
    }

    if (!geocodeQuery) {
        const m = lower.match(/\b(?:in|near|around|at)\s+([a-z0-9][a-z0-9\s.'-]{1,40})/i);
        if (m?.[1]) {
            const place = m[1].replace(/\b(tonight|today|tomorrow|please|for|me)\b/g, '').trim();
            if (place.length >= 2) {
                city = place;
                geocodeQuery = `${place}, ${DEFAULT_COUNTRY}`;
            }
        }
    }

    const nearMe = /\bnear me\b|\bnearby\b|\baround me\b/.test(lower);

    return {
        raw: text,
        intents,
        city,
        geocodeQuery,
        nearMe,
        constraints: {
            budget: intents.includes('budget'),
            quiet: intents.includes('quiet'),
            romantic: intents.includes('romantic'),
        },
    };
};

const osmFiltersFor = (intents) => {
    const set = new Set();
    const list = intents.length ? intents : ['default'];
    for (const intent of list) {
        const rows = INTENT_OSM[intent] || INTENT_OSM.default;
        rows.forEach((r) => set.add(r));
    }
    if (!intents.length) INTENT_OSM.default.forEach((r) => set.add(r));
    return [...set];
};

async function nominatimGeocode(q) {
    const url = `${NOMINATIM}?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) throw new AppError('Location lookup failed (Nominatim). Try again in a moment.', 502);
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    const hit = data[0];
    return {
        lat: Number(hit.lat),
        lng: Number(hit.lon),
        label: hit.display_name,
        city:
            hit.address?.city
            || hit.address?.town
            || hit.address?.state_district
            || hit.address?.state
            || null,
    };
}

async function overpassSearch({ lat, lng, radiusMeters, filters }) {
    const around = filters
        .map((f) => `${f}(around:${radiusMeters},${lat},${lng});`)
        .join('\n');
    const body = `
[out:json][timeout:30];
(
${around}
);
out center 40;
`.trim();

    const res = await fetch(OVERPASS, {
        method: 'POST',
        headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(body)}`,
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new AppError(
            `Place search failed (OpenStreetMap Overpass${text ? '' : ''}). Try a simpler query or wait a few seconds.`,
            502,
        );
    }

    const data = await res.json();
    return Array.isArray(data.elements) ? data.elements : [];
}

const haversineKm = (aLat, aLng, bLat, bLng) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x =
        Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};

const elementToPlace = (el, center, parsed) => {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) return null;

    const name = tags.name || tags['name:en'] || tags.brand;
    if (!name) return null;

    const amenity = tags.amenity || tags.leisure || tags.tourism || tags.natural || 'place';
    const categories = [amenity];
    if (tags.cuisine) categories.push(...String(tags.cuisine).split(';').map((s) => s.trim()));

    const vibeTags = [];
    if (tags.outdoor_seating === 'yes') vibeTags.push('outdoor');
    if (tags.cuisine) vibeTags.push('food');
    if (amenity === 'cafe') vibeTags.push('coffee', 'cafe');
    if (['bar', 'pub', 'biergarten'].includes(amenity)) vibeTags.push('drinks', 'nightlife');
    if (['park', 'garden'].includes(amenity)) vibeTags.push('outdoors', 'calm', 'quiet');
    if (amenity === 'beach' || tags.natural === 'beach') vibeTags.push('beach');
    if (tags.tourism === 'viewpoint') vibeTags.push('views', 'photos');
    if (parsed.constraints.romantic && ['restaurant', 'bar', 'cafe'].includes(amenity)) {
        vibeTags.push('romantic');
    }

    const address = [
        tags['addr:housenumber'],
        tags['addr:street'],
        tags['addr:suburb'] || tags['addr:neighbourhood'],
        tags['addr:city'],
    ].filter(Boolean).join(', ') || tags['addr:full'] || parsed.city || center.label;

    const distKm = haversineKm(center.lat, center.lng, lat, lng);
    const priceLevel = tags.fee === 'yes' ? 3 : amenity === 'fast_food' ? 1 : amenity === 'restaurant' ? 2 : 2;

    return {
        id: `osm-${el.type}-${el.id}`,
        name,
        city: tags['addr:city'] || center.city || parsed.city || '',
        address,
        lat,
        lng,
        categories,
        priceLevel,
        rating: null,
        vibeTags,
        hours: tags.opening_hours || null,
        summary: tags.description || `${amenity.replace(/_/g, ' ')} on OpenStreetMap`,
        source: 'openstreetmap',
        osmType: el.type,
        osmId: el.id,
        distanceKm: Math.round(distKm * 100) / 100,
        tags,
    };
};

const reasonFor = (place, parsed) => {
    const reasons = [];
    const amenity = place.categories[0];

    if (parsed.intents.includes('drinks') && ['bar', 'pub', 'biergarten'].includes(amenity)) {
        reasons.push('Mapped as a bar/pub on OpenStreetMap');
    }
    if (parsed.intents.includes('coffee') && amenity === 'cafe') {
        reasons.push('Real cafe listed on OpenStreetMap');
    }
    if (parsed.intents.includes('food') && ['restaurant', 'fast_food'].includes(amenity)) {
        reasons.push('Restaurant / food place from OSM');
    }
    if (parsed.intents.includes('outdoors') && ['park', 'garden', 'viewpoint'].includes(amenity)) {
        reasons.push('Outdoor / park / viewpoint');
    }
    if (parsed.intents.includes('beach') && (amenity === 'beach' || place.vibeTags.includes('beach'))) {
        reasons.push('Beach feature on the map');
    }
    if (parsed.constraints.romantic && ['restaurant', 'bar', 'cafe'].includes(amenity)) {
        reasons.push('Good candidate for a quieter date-night stop');
    }
    if (place.tags?.outdoor_seating === 'yes') reasons.push('Has outdoor seating');
    if (place.distanceKm != null) reasons.push(`${place.distanceKm} km from search center`);

    if (!reasons.length) {
        reasons.push(`Live OpenStreetMap ${amenity.replace(/_/g, ' ')}`);
    }
    return reasons.slice(0, 2).join(' · ');
};

const scorePlace = (place, parsed) => {
    let score = 40;
    score += Math.max(0, 25 - place.distanceKm * 3);

    for (const intent of parsed.intents) {
        if (place.vibeTags.includes(intent) || place.categories.includes(intent)) score += 16;
        if (intent === 'coffee' && place.categories.includes('cafe')) score += 20;
        if (intent === 'drinks' && ['bar', 'pub'].some((c) => place.categories.includes(c))) score += 20;
        if (intent === 'food' && ['restaurant', 'fast_food'].some((c) => place.categories.includes(c))) score += 18;
        if (intent === 'outdoors' && ['park', 'garden', 'viewpoint'].some((c) => place.categories.includes(c))) score += 18;
        if (intent === 'budget' && place.categories.includes('fast_food')) score += 10;
    }

    if (place.tags?.opening_hours) score += 4;
    if (place.tags?.cuisine) score += 3;
    if (place.tags?.website || place.tags?.phone) score += 2;

    return Math.round(score * 10) / 10;
};

/**
 * Explore search: Google Places + OpenAI when configured; OSM Overpass otherwise.
 */
export const searchExplorePlaces = async (query, {
    limit = 5,
    lat = null,
    lng = null,
} = {}) => {
    let parsed = parseExploreQuery(query);
    if (!parsed.raw) {
        return { parsed, results: [], center: null, source: null };
    }

    parsed = await refineExploreIntent(parsed.raw, parsed);
    const take = Math.min(Number(limit) || 5, 10);

    let center = null;
    if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
        center = {
            lat: Number(lat),
            lng: Number(lng),
            label: 'Your location',
            city: parsed.city || null,
        };
    }

    // No GPS and no city in the query — fall back to the configured home area
    // so results stay local instead of drifting to whatever Google ranks first.
    if (!center && !parsed.geocodeQuery) {
        center = getExploreDefaultCenter();
    }

    // Prefer Google Places when key is set
    if (isGooglePlacesConfigured()) {
        if (!center && parsed.geocodeQuery) {
            try {
                center = await nominatimGeocode(parsed.geocodeQuery);
            } catch {
                /* optional for text search */
            }
        }

        const textQuery = parsed.searchQuery || parsed.raw;
        try {
            // Only bias to a point when we actually know one; otherwise the
            // country-level region bias in googlePlacesTextSearch does the work.
            const googlePlaces = await googlePlacesTextSearch({
                query: textQuery,
                lat: center?.lat ?? null,
                lng: center?.lng ?? null,
                intents: parsed.intents,
                limit: Math.max(take, 8),
            });

            if (googlePlaces?.length) {
                const originCenter = center;
                if (!center && googlePlaces[0]) {
                    center = {
                        lat: googlePlaces[0].lat,
                        lng: googlePlaces[0].lng,
                        label: parsed.city || googlePlaces[0].address,
                        city: parsed.city || null,
                    };
                }

                let results = googlePlaces.map((p) => {
                    // Distance is only meaningful from a real origin, not from
                    // whichever result happened to rank first.
                    const distanceKm = originCenter
                        ? Math.round(haversineKm(originCenter.lat, originCenter.lng, p.lat, p.lng) * 100) / 100
                        : null;
                    const withDist = { ...p, distanceKm };
                    let score = 50;
                    if (p.rating) score += p.rating * 8;
                    if (p.userRatingsTotal) score += Math.min(15, Math.log10(p.userRatingsTotal + 1) * 5);
                    if (distanceKm != null) score += Math.max(0, 20 - distanceKm * 2);
                    if (parsed.constraints.budget && p.priceLevel != null && p.priceLevel <= 1) score += 10;
                    if (parsed.constraints.budget && p.priceLevel >= 3) score -= 8;

                    const bits = [];
                    if (p.rating) bits.push(`${p.rating}★` + (p.userRatingsTotal ? ` (${p.userRatingsTotal})` : ''));
                    if (distanceKm != null) bits.push(`${distanceKm} km away`);
                    if (p.hours) bits.push(p.hours);
                    bits.push('Google Places');

                    return {
                        ...withDist,
                        photoUrl: googlePhotoUrl(p.photoRef),
                        score: Math.round(score * 10) / 10,
                        reason: bits.join(' · '),
                        reasonSource: 'google',
                    };
                });

                results = results
                    .sort((a, b) => b.score - a.score)
                    .slice(0, take);

                results = await enrichPlaceReasons(parsed.raw, results);

                return {
                    parsed: { ...parsed, city: parsed.city || center?.city },
                    center,
                    results,
                    source: 'google_places',
                    providers: {
                        places: 'google',
                        llm: Boolean(parsed.llm),
                    },
                };
            }
        } catch (err) {
            console.warn('[explore] Google Places failed, falling back to OSM:', err.message);
        }
    }

    // OSM fallback (still live — not mock)
    if (!center && parsed.geocodeQuery) {
        center = await nominatimGeocode(parsed.geocodeQuery);
    } else if (!center && parsed.nearMe) {
        throw new AppError(
            'Share your location for “near me”, or add a city like “in Bangalore”.',
            400,
        );
    } else if (!center) {
        center = await nominatimGeocode(`${parsed.raw}, ${DEFAULT_COUNTRY}`).catch(() => null);
    }

    if (!center) {
        throw new AppError(
            'Tell me where to look — add a city like “cafes in Bangalore”, or allow location and say “near me”.',
            404,
        );
    }

    const filters = osmFiltersFor(parsed.intents);
    const radius = parsed.intents.includes('beach') || parsed.intents.includes('outdoors') ? 12000 : 5000;
    const elements = await overpassSearch({
        lat: center.lat,
        lng: center.lng,
        radiusMeters: radius,
        filters,
    });

    const seen = new Set();
    let places = [];
    for (const el of elements) {
        const place = elementToPlace(el, center, parsed);
        if (!place || seen.has(place.id)) continue;
        seen.add(place.id);
        places.push({
            ...place,
            score: scorePlace(place, parsed),
            reason: reasonFor(place, parsed),
            reasonSource: 'osm',
        });
    }

    places = places
        .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm)
        .slice(0, take);

    places = await enrichPlaceReasons(parsed.raw, places);

    return {
        parsed: {
            ...parsed,
            city: parsed.city || center.city,
        },
        center,
        results: places,
        source: 'openstreetmap',
        providers: {
            places: 'openstreetmap',
            llm: Boolean(parsed.llm),
        },
    };
};
