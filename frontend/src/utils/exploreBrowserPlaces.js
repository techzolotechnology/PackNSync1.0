import { importGoogleMapsLibrary } from './googleMapsLoader.js';

const PRICE_LEVEL = { FREE: 0, INEXPENSIVE: 1, MODERATE: 2, EXPENSIVE: 3, VERY_EXPENSIVE: 4 };
const MAP_SEARCH_PREFIX = 'https://www.google.com/maps/search/?';

export async function searchBrowserPlaces(fallbackUrl, { location, budget } = {}) {
    if (typeof fallbackUrl !== 'string' || !fallbackUrl.startsWith(MAP_SEARCH_PREFIX)) return [];
    const textQuery = new URL(fallbackUrl).searchParams.get('query');
    if (!textQuery) return [];

    let timeout;
    try {
        const lookup = async () => {
            const library = await importGoogleMapsLibrary('places');
            if (!library?.Place?.searchByText) return [];
            const { places = [] } = await library.Place.searchByText({
                textQuery,
                region: 'in',
                maxResultCount: 5,
                fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'priceLevel'],
                ...(location ? { locationBias: location } : {}),
                ...(budget ? { priceLevels: ['INEXPENSIVE', 'MODERATE'] } : {}),
            });
            return places.filter((p) => p.id && p.location && p.displayName).map((p) => ({
                id: `gplace-${p.id}`,
                name: p.displayName,
                address: p.formattedAddress || '',
                lat: p.location.lat(),
                lng: p.location.lng(),
                rating: p.rating,
                userRatingsTotal: p.userRatingCount,
                priceLevel: PRICE_LEVEL[p.priceLevel],
                reason: 'Result from Google Maps',
            }));
        };
        return await Promise.race([lookup(), new Promise((resolve) => { timeout = setTimeout(() => resolve([]), 7_000); })]);
    } catch {
        return [];
    } finally {
        clearTimeout(timeout);
    }
}
