/**
 * GitHub Pages has no server rewrite for SPAs.
 * Copy dist/index.html into each client route folder so deep links return HTTP 200.
 *
 * Each copy gets that route's title, description, canonical, Open Graph and
 * robots tags baked in (from frontend/src/seo/seoConfig.js), so crawlers and
 * link previews see the right metadata without running JavaScript.
 * Also writes dist/sitemap.xml from the same config.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_SEO,
  NOINDEX_ROUTES,
  RENTAL_CITIES,
  ROUTE_SEO,
  SITEMAP_PATHS,
  canonicalUrl,
  citySeo,
} from '../frontend/src/seo/seoConfig.js';
import { DESTINATIONS, destinationSeo } from '../frontend/src/seo/destinations.js';
import { GUIDES, guideSeo } from '../frontend/src/seo/guides.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const distArg = process.argv[2];
const outDir = distArg
  ? path.resolve(root, distArg)
  : path.resolve(root, 'frontend/dist');

/** Client routes without their own SEO entry; they get the default tags. */
const EXTRA_ROUTES = [
  'trips/create',
  'terms/privacy',
  'terms/service',
  'terms/rental',
];

const escapeAttr = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function seoFor(route) {
  if (ROUTE_SEO[route]) return { ...ROUTE_SEO[route], noindex: false };
  const city = RENTAL_CITIES.find((c) => `rentals/${c.slug}` === route);
  if (city) return { ...citySeo(city), noindex: false };
  const destination = DESTINATIONS.find((d) => `destinations/${d.slug}` === route);
  if (destination) return { ...destinationSeo(destination), noindex: false };
  const guide = GUIDES.find((g) => `guides/${g.slug}` === route);
  if (guide) return { ...guideSeo(guide), noindex: false };
  if (route.startsWith('terms/')) return { ...ROUTE_SEO.terms, noindex: false };
  return { ...DEFAULT_SEO, noindex: NOINDEX_ROUTES.includes(route) };
}

function replaceTag(html, pattern, replacement, route) {
  if (!pattern.test(html)) {
    throw new Error(`index.html is missing a tag matching ${pattern} (needed for /${route})`);
  }
  return html.replace(pattern, replacement);
}

function withSeo(html, route) {
  const { title, description, noindex } = seoFor(route);
  const url = canonicalUrl(route);
  const t = escapeAttr(title);
  const d = escapeAttr(description);

  let out = html;
  out = replaceTag(out, /<title>[\s\S]*?<\/title>/, `<title>${t}</title>`, route);
  out = replaceTag(out, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`, route);
  out = replaceTag(out, /<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}" />`, route);
  out = replaceTag(out, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, route);
  out = replaceTag(out, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}" />`, route);
  out = replaceTag(out, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`, route);
  out = replaceTag(out, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`, route);
  out = replaceTag(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${t}" />`, route);
  out = replaceTag(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${d}" />`, route);
  return out;
}

function sitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = SITEMAP_PATHS.map((p) => {
    const isHome = p === '/';
    const isCity = p.startsWith('/rentals/') || p.startsWith('/destinations');
    const priority = isHome ? '1.0' : isCity ? '0.8' : p === '/rentals' || p === '/trips' ? '0.9' : '0.5';
    const changefreq = isHome || p === '/rentals' || p === '/trips' || isCity ? 'daily' : 'monthly';
    return [
      '  <url>',
      `    <loc>${canonicalUrl(p)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n');
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const indexPath = path.join(outDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error(`Missing ${indexPath}. Build the frontend first.`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');

// Unknown deep links (e.g. /trips/<id>) are served 404.html with default tags.
fs.writeFileSync(path.join(outDir, '404.html'), html);

const routes = [...new Set([
  ...Object.keys(ROUTE_SEO).filter(Boolean),
  ...RENTAL_CITIES.map((c) => `rentals/${c.slug}`),
  ...DESTINATIONS.map((d) => `destinations/${d.slug}`),
  ...GUIDES.map((g) => `guides/${g.slug}`),
  ...NOINDEX_ROUTES,
  ...EXTRA_ROUTES,
])];

for (const route of routes) {
  const dir = path.join(outDir, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), withSeo(html, route));
  console.log(`wrote ${path.relative(root, path.join(dir, 'index.html'))}`);
}

fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml());
console.log(`wrote sitemap.xml (${SITEMAP_PATHS.length} urls)`);

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log('SPA route fallbacks ready.');
