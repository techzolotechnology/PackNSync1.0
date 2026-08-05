import { Loader } from '@googlemaps/js-api-loader';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

let loaderInstance = null;
let mapsPromise = null;

function getLoader() {
    if (!API_KEY) return null;
    if (!loaderInstance) {
        loaderInstance = new Loader({
            apiKey: API_KEY,
            version: 'weekly',
        });
    }
    return loaderInstance;
}

/** Load the Maps JS API once; returns `google.maps` or null when no API key. */
export function loadGoogleMaps() {
    if (!API_KEY) return Promise.resolve(null);
    if (window.google?.maps?.importLibrary) {
        return Promise.resolve(window.google.maps);
    }
    if (!mapsPromise) {
        const loader = getLoader();
        mapsPromise = loader
            .load()
            .then(() => window.google?.maps ?? null)
            .catch((err) => {
                mapsPromise = null;
                throw err;
            });
    }
    return mapsPromise;
}

/** Import a Maps library after the core API is loaded. */
export async function importGoogleMapsLibrary(name) {
    const maps = await loadGoogleMaps();
    if (!maps) return null;
    return maps.importLibrary(name);
}

export function hasGoogleMapsApiKey() {
    return Boolean(API_KEY);
}

export function getGoogleMapsApiKey() {
    return API_KEY;
}
