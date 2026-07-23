export const PROVIDER_DEEP_LINKS = [
    { id: 'uber', name: 'Uber', color: '#000000' },
    { id: 'ola', name: 'Ola', color: '#BDE32B', textDark: true },
    { id: 'rapido', name: 'Rapido', color: '#FFD100', textDark: true },
    { id: 'zoomcar', name: 'Zoomcar', color: '#10B981' },
];

export function getProviderDeepLink(providerId, pickup, dropoff) {
    const drop = encodeURIComponent(dropoff || '');
    const pick = encodeURIComponent(pickup || '');
    const route = encodeURIComponent(`${pickup || ''} to ${dropoff || ''}`);

    switch (providerId) {
        case 'uber':
            return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${drop}`;
        case 'ola':
            return `https://book.olacabs.com/?pickup_name=${pick}&drop_name=${drop}`;
        case 'rapido':
            return 'https://www.rapido.bike/Home';
        case 'zoomcar':
            return `https://www.zoomcar.com/search?query=${route}`;
        default:
            return null;
    }
}

export function openProviderApp(providerId, pickup, dropoff) {
    const url = getProviderDeepLink(providerId, pickup, dropoff);
    if (!url) return false;
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
}
