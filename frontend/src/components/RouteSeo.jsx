import { useLocation } from 'react-router-dom';
import useSeo from '../hooks/useSeo.js';
import {
    DEFAULT_SEO,
    NOINDEX_ROUTES,
    ROUTE_SEO,
    citySeo,
    findRentalCity,
} from '../seo/seoConfig.js';
import { destinationSeo, findDestination } from '../seo/destinations.js';
import { findGuide, guideSeo } from '../seo/guides.js';

const PRIVATE_PREFIXES = ['profile/', 'trips/create', 'reports/'];

function seoForPath(pathname) {
    const key = pathname.replace(/^\/+|\/+$/g, '');

    if (ROUTE_SEO[key]) return ROUTE_SEO[key];

    const cityMatch = key.match(/^rentals\/([^/]+)$/);
    if (cityMatch) {
        const city = findRentalCity(cityMatch[1]);
        if (city) return citySeo(city);
    }

    const destMatch = key.match(/^destinations\/([^/]+)$/);
    if (destMatch) {
        const destination = findDestination(destMatch[1]);
        if (destination) return destinationSeo(destination);
    }

    const guideMatch = key.match(/^guides\/([^/]+)$/);
    if (guideMatch) {
        const guide = findGuide(guideMatch[1]);
        if (guide) return guideSeo(guide);
    }

    if (NOINDEX_ROUTES.includes(key) || PRIVATE_PREFIXES.some((p) => key.startsWith(p))) {
        return { ...DEFAULT_SEO, noindex: true };
    }
    if (key.startsWith('terms/')) return ROUTE_SEO.terms;

    // Dynamic pages (e.g. /trips/:id) set their own tags once data loads.
    return DEFAULT_SEO;
}

/** Default SEO tags for the current route. */
export default function RouteSeo() {
    const { pathname } = useLocation();
    const seo = seoForPath(pathname);
    useSeo({ ...seo, path: pathname });
    return null;
}
