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
  TRIP_SPLITTER_HEADER,
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
const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

function staticBody(route) {
  if (!route) {
    return `<main class="container guide-article home-seo-content">
      <h1>PickAndSync brings group trips, cost splitting and rentals together</h1>
      <p class="dst-lead">Plan a trip with friends, coordinate the details, split shared expenses, and find self-drive cars, bikes or scooters from local hosts across India.</p>
      <p><a href="/trips/">Browse or plan a group trip</a> · <a href="/tools/trip-cost-splitter/">Split trip costs for free</a> · <a href="/rentals/">Explore vehicle rentals</a></p>
      <section><h2>Plan a group trip with friends</h2>
        <p>Create a shared plan, invite your group, coordinate the itinerary and keep trip details together. Start with the <a href="/guides/group-trip-planning-checklist-india/">group trip planning checklist</a>.</p>
      </section>
      <section><h2>Split travel expenses clearly</h2>
        <p>Add shared costs and see who owes whom with the <a href="/tools/trip-cost-splitter/">free trip cost splitter</a>. No account is needed to try the calculator.</p>
      </section>
      <section><h2>Find cars, bikes and scooters for your trip</h2>
        <p>Browse local vehicle listings and check dates before requesting a booking. See <a href="/rentals/bangalore/">Bangalore rentals</a>, <a href="/rentals/haryana/">Haryana rentals</a>, or <a href="/rentals/">all rental locations</a>.</p>
      </section>
      <p>PickAndSync is operated by TECHZOLO TECHNOLOGIES LLP. Travelers can explore the <a href="https://play.google.com/store/apps/details?id=com.packandsync.app">PickAndSync Android app</a>; vehicle owners can learn about <a href="/become-a-host/">hosting a vehicle</a>.</p>
    </main>`;
  }

  const guide = GUIDES.find((item) => `guides/${item.slug}` === route);
  if (guide) {
    const sections = guide.sections.map((section) => `<section class="guide-section">
      <h2>${escapeHtml(section.heading)}</h2>
      ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n')}
      ${section.list ? `<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      ${section.steps ? `<ol>${section.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : ''}
      ${section.link ? `<p><a href="${escapeAttr(section.link.to)}">${escapeHtml(section.link.label)}</a></p>` : ''}
    </section>`).join('\n');
    return `<div class="dst-page page-atmosphere"><article class="container guide-article">
      <header><h1>${escapeHtml(guide.title)}</h1><p class="dst-lead">${escapeHtml(guide.intro)}</p></header>
      ${sections}
      <p><a href="${escapeAttr(guide.cta.to)}">${escapeHtml(guide.cta.label)}</a></p>
      <p><a href="/trips/create/">Create a group trip</a></p>
    </article></div>`;
  }

  if (route === 'trips') {
    return `<main class="container guide-article"><h1>Plan a Group Trip with Friends</h1>
      <p class="dst-lead">Use PickAndSync as a group trip planner in India: browse open trips to find travel companions, or post a trip of your own.</p>
      <p>Share the destination and dates, coordinate the itinerary and trip chat, and keep shared costs together with the group.</p>
      <p><a href="/trips/create/">Post a group trip</a> · <a href="/guides/group-trip-planning-checklist-india/">Read the group trip planning checklist</a></p>
      <section><h2>Find travel companions for an open trip</h2>
        <p>Browse trips posted by travelers, review the plan, and request to join when it suits your dates and destination.</p>
      </section>
      <section><h2>Plan the itinerary and split trip costs</h2>
        <p>Keep trip details and shared expenses with the group. Try the <a href="/tools/trip-cost-splitter/">free trip cost splitter</a> to see who owes whom.</p>
      </section>
    </main>`;
  }

  const city = RENTAL_CITIES.find((item) => `rentals/${item.slug}` === route);
  if (city) {
    return `<main class="container guide-article"><h1>Self Drive Car Rental in ${escapeHtml(city.name)}</h1>
      <p class="dst-lead">${escapeHtml(city.intro)}</p>
      <p>Browse available cars, bikes and scooters, compare daily prices, and choose dates before requesting a booking.</p>
      ${city.getaways?.length ? `<h2>Popular drives from ${escapeHtml(city.name)}</h2><ul>${city.getaways.map((place) => `<li>${escapeHtml(place.name)}${place.km ? ` — about ${escapeHtml(place.km)} km` : ''}</li>`).join('')}</ul>` : ''}
      <p><a href="/trips/">Plan a group trip</a> · <a href="/tools/trip-cost-splitter/">Split the trip costs</a> · <a href="/host/">List your vehicle</a></p>
    </main>`;
  }

  return '';
}

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
  if (!route) {
    const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
    const heroId = process.env.VITE_HERO_VIDEO_ID?.trim() || 'packandsync/hero-bg';
    if (/^[a-zA-Z0-9_-]+$/.test(cloudName || '') && /^[a-zA-Z0-9/_-]+$/.test(heroId)) {
      const poster = `https://res.cloudinary.com/${cloudName}/video/upload/so_1,w_1280,q_auto,f_auto/${heroId}.jpg`;
      const preload = `<link rel="preconnect" href="https://res.cloudinary.com" crossorigin />\n    <link rel="preload" as="image" fetchpriority="high" href="${poster}" />`;
      out = replaceTag(out, /<\/head>/, `${preload}\n  </head>`, route);
    }
  }
  out = replaceTag(out, /<title>[\s\S]*?<\/title>/, `<title>${t}</title>`, route);
  out = replaceTag(out, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${d}" />`, route);
  out = replaceTag(out, /<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}" />`, route);
  out = replaceTag(out, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, route);
  out = replaceTag(out, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${t}" />`, route);
  out = replaceTag(out, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${d}" />`, route);
  out = replaceTag(out, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`, route);
  out = replaceTag(out, /<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${t}" />`, route);
  out = replaceTag(out, /<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${d}" />`, route);
  if (route === 'tools/trip-cost-splitter') {
    const { title, kicker, intro } = TRIP_SPLITTER_HEADER;
    const header = `<main class="container"><header class="dst-header">
      <p class="dst-kicker">${escapeAttr(kicker)}</p>
      <h1>${escapeAttr(title)}</h1>
      <p class="dst-lead">${escapeAttr(intro)}</p>
    </header></main>`;
    out = replaceTag(out, /<div id="root"><\/div>/, `<div id="root">${header}</div>`, route);
  }
  const body = staticBody(route);
  if (body) out = replaceTag(out, /<div id="root"><\/div>/, `<div id="root">${body}</div>`, route);
  const routeDepth = route ? route.split('/').length : 0;
  out = out.replace(/((?:src|href)=")\.\/(assets\/|favicon\.svg)/g, `$1${'../'.repeat(routeDepth)}$2`);
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

// The homepage is the main branded entry point. Include its text in the first
// response so crawlers and link previews can understand it without JS rendering.
fs.writeFileSync(indexPath, withSeo(html, ''));
console.log('wrote crawlable homepage content');

fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemapXml());
console.log(`wrote sitemap.xml (${SITEMAP_PATHS.length} urls)`);

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log('SPA route fallbacks ready.');
