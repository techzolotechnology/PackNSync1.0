/**
 * GitHub Pages has no server rewrite for SPAs.
 * Copy dist/index.html into each client route folder so deep links return HTTP 200.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const distArg = process.argv[2];
const outDir = distArg
  ? path.resolve(root, distArg)
  : path.resolve(root, 'frontend/dist');

const ROUTES = [
  'login',
  'register',
  'trips',
  'trips/create',
  'rentals',
  'explore',
  'bookings',
  'host',
  'verify',
  'admin',
  'privacy-policy',
  'terms',
  'terms/privacy',
  'terms/service',
  'terms/rental',
];

const indexPath = path.join(outDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error(`Missing ${indexPath}. Build the frontend first.`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
fs.writeFileSync(path.join(outDir, '404.html'), html);

for (const route of ROUTES) {
  const dir = path.join(outDir, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`wrote ${path.relative(root, path.join(dir, 'index.html'))}`);
}

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log('SPA route fallbacks ready.');
