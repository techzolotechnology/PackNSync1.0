import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/images/stock');

const ASSETS = [
    { file: 'car-hero.jpg', photo: 'photo-1503376780353-7e6692767b70', w: 900 },
    { file: 'bike-hero.jpg', photo: 'photo-1558981403-c5f9899a28bc', w: 900 },
    { file: 'trip-1.jpg', photo: 'photo-1537996194471-e657df975ab4', w: 800 },
    { file: 'trip-2.jpg', photo: 'photo-1506905925346-21bda4d32df4', w: 800 },
    { file: 'trip-3.jpg', photo: 'photo-1493976040374-85c8e12f0c0e', w: 800 },
    { file: 'trip-road.jpg', photo: 'photo-1469854523086-cc02fe5d8800', w: 800 },
    { file: 'trip-5.jpg', photo: 'photo-1500530855697-b586d89ba3ee', w: 800 },
    { file: 'trip-6.jpg', photo: 'photo-1476514525535-07fb3b4ae5f1', w: 800 },
    { file: 'car-classic.jpg', photo: 'photo-1519641471654-76ce0107ad1b', w: 800 },
    { file: 'car-suv.jpg', photo: 'photo-1533473359331-0135ef1b58bf', w: 800 },
    { file: 'car-ev.jpg', photo: 'photo-1593941707882-a5bba14938c7', w: 800 },
    { file: 'car-luxury.jpg', photo: 'photo-1549317661-bd32c8ce0db2', w: 800 },
    { file: 'bike-commuter.jpg', photo: 'photo-1527905890126-e4d915153e25', w: 800 },
    { file: 'bike-sports.jpg', photo: 'photo-1591637333184-19aa84b3e01f', w: 800 },
    { file: 'bike-scooter.jpg', photo: 'photo-1712213248719-aade0e02a591', w: 800 },
    { file: 'bike-ev.jpg', photo: 'photo-1623079398404-4a024f3f4aee', w: 800 },
    { file: 'explore-place.jpg', photo: 'photo-1517248135467-4c7edcad34c4', w: 600 },
];

function unsplashUrl(photo, w) {
    return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${w}&q=75`;
}

async function downloadOne({ file, photo, w }) {
    const url = unsplashUrl(photo, w);
    const dest = path.join(outDir, file);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed ${file}: ${res.status} ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log(`${file} — ${(buf.length / 1024).toFixed(1)} KB`);
}

fs.mkdirSync(outDir, { recursive: true });

for (const asset of ASSETS) {
    await downloadOne(asset);
}

console.log(`\nSaved ${ASSETS.length} images to ${outDir}`);
