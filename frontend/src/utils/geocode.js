const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

export async function reverseGeocode(lat, lng) {
    if (!API_KEY) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
        console.warn('[Geocode]', data.status, data.error_message);
        return null;
    }

    return data.results[0].formatted_address;
}

export async function geocodeAddress(address) {
    if (!API_KEY || !address?.trim()) return null;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) return null;

    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng, label: data.results[0].formatted_address };
}
