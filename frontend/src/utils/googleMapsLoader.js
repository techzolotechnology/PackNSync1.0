import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

let optionsConfigured = false;
let mapsPromise = null;

function ensureOptions() {
    if (!API_KEY || optionsConfigured) return;
    try {
        setOptions({
            key: API_KEY,
            v: 'weekly',
        });
        optionsConfigured = true;
    } catch (err) {
        console.warn('[googleMapsLoader] Failed to set options:', err);
    }
}

/** Load the Maps JS API once; returns `google.maps` or null when no API key. */
export function loadGoogleMaps() {
    if (!API_KEY) return Promise.resolve(null);
    if (window.google?.maps?.importLibrary) {
        return Promise.resolve(window.google.maps);
    }
    if (!mapsPromise) {
        ensureOptions();
        mapsPromise = importLibrary('maps')
            .then(() => window.google?.maps ?? null)
            .catch((err) => {
                mapsPromise = null;
                console.warn('[googleMapsLoader] Failed to load Google Maps:', err);
                return null;
            });
    }
    return mapsPromise;
}

/** Import a Maps library after the core API is loaded. */
export async function importGoogleMapsLibrary(name) {
    if (!API_KEY) return null;
    ensureOptions();
    if (window.google?.maps?.importLibrary) {
        return window.google.maps.importLibrary(name);
    }
    try {
        return await importLibrary(name);
    } catch (err) {
        console.warn(`[googleMapsLoader] Failed to import library ${name}:`, err);
        return null;
    }
}

export function hasGoogleMapsApiKey() {
    return Boolean(API_KEY);
}

export function getGoogleMapsApiKey() {
    return API_KEY;
}

