import { useEffect } from 'react';
import { DEFAULT_IMAGE, DEFAULT_SEO, SITE_NAME, canonicalUrl } from '../seo/seoConfig.js';

function upsertMeta(attr, key, content) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function upsertCanonical(href) {
    let el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function setJsonLd(data) {
    const id = 'seo-jsonld';
    document.getElementById(id)?.remove();
    if (!data) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);
}

/**
 * Per-route title, description, canonical, Open Graph and robots tags.
 * Static fallbacks already carry these for crawlers; this keeps them correct
 * during client-side navigation.
 *
 * @param {{ title?: string, description?: string, path?: string,
 *           image?: string, noindex?: boolean, jsonLd?: object }} seo
 */
export default function useSeo({ title, description, path, image, noindex = false, jsonLd } = {}) {
    useEffect(() => {
        const pageTitle = title || DEFAULT_SEO.title;
        const pageDescription = description || DEFAULT_SEO.description;
        const url = canonicalUrl(path ?? window.location.pathname);

        document.title = pageTitle;
        upsertMeta('name', 'description', pageDescription);
        upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
        upsertCanonical(url);

        upsertMeta('property', 'og:site_name', SITE_NAME);
        upsertMeta('property', 'og:type', 'website');
        upsertMeta('property', 'og:title', pageTitle);
        upsertMeta('property', 'og:description', pageDescription);
        upsertMeta('property', 'og:url', url);
        upsertMeta('property', 'og:image', image || DEFAULT_IMAGE);
        upsertMeta('name', 'twitter:card', 'summary_large_image');
        upsertMeta('name', 'twitter:title', pageTitle);
        upsertMeta('name', 'twitter:description', pageDescription);

        setJsonLd(jsonLd || null);
    }, [title, description, path, image, noindex, jsonLd]);
}
