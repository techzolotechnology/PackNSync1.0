const listing = 'https://play.google.com/store/apps/details?id=com.packandsync.app';

export function customerPlayStoreUrl(placement) {
    const url = new URL(listing);
    url.searchParams.set('referrer', new URLSearchParams({
        utm_source: 'pickandsync_web',
        utm_medium: 'website',
        utm_campaign: placement,
    }).toString());
    return url.href;
}
