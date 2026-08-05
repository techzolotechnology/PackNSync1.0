import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

dotenv.config({ path: path.join(backendRoot, '.env') });

const { cloudinary, isCloudinaryConfigured } = await import('../src/utils/cloudinary.js');

const HERO_PUBLIC_ID = process.env.HERO_VIDEO_PUBLIC_ID?.trim() || 'packandsync/hero-bg';
const HERO_SOURCE = path.resolve(repoRoot, 'frontend/public/videos/hero-bg.mp4');
const FRONTEND_ENV = path.resolve(repoRoot, 'frontend/.env');

function buildDeliveryUrls(cloudName, publicId) {
    const base = `https://res.cloudinary.com/${cloudName}/video/upload`;
    return {
        video: `${base}/w_1280,q_auto,vc_auto,ac_none,f_auto/${publicId}.mp4`,
        poster: `${base}/so_1,w_1280,q_auto,f_jpg/${publicId}.jpg`,
    };
}

function upsertFrontendEnv(cloudName, publicId) {
    const lines = [
        `VITE_CLOUDINARY_CLOUD_NAME=${cloudName}`,
        `VITE_HERO_VIDEO_ID=${publicId}`,
    ];
    if (fs.existsSync(FRONTEND_ENV)) {
        const existing = fs.readFileSync(FRONTEND_ENV, 'utf8');
        const filtered = existing
            .split(/\r?\n/)
            .filter((line) => !/^VITE_CLOUDINARY_CLOUD_NAME=/.test(line) && !/^VITE_HERO_VIDEO_ID=/.test(line))
            .join('\n')
            .replace(/\n+$/, '');
        const prefix = filtered ? `${filtered}\n` : '';
        fs.writeFileSync(FRONTEND_ENV, `${prefix}${lines.join('\n')}\n`, 'utf8');
        return;
    }
    fs.writeFileSync(FRONTEND_ENV, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
    if (!isCloudinaryConfigured()) {
        throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env');
    }
    if (!fs.existsSync(HERO_SOURCE)) {
        throw new Error(`Hero video not found at ${HERO_SOURCE}`);
    }

    const sourceBytes = fs.statSync(HERO_SOURCE).size;
    console.log(`Uploading hero video (${(sourceBytes / 1024 / 1024).toFixed(2)} MB) → ${HERO_PUBLIC_ID}`);

    const result = await cloudinary.uploader.upload(HERO_SOURCE, {
        resource_type: 'video',
        public_id: HERO_PUBLIC_ID,
        overwrite: true,
        invalidate: true,
    });

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME.trim();
    const urls = buildDeliveryUrls(cloudName, HERO_PUBLIC_ID);

    upsertFrontendEnv(cloudName, HERO_PUBLIC_ID);

    console.log('\nUpload complete.');
    console.log(`public_id=${result.public_id}`);
    console.log(`bytes=${result.bytes} (${(result.bytes / 1024 / 1024).toFixed(2)} MB stored on Cloudinary)`);
    console.log(`secure_url=${result.secure_url}`);
    console.log('\nDelivery URLs (optimized on first request):');
    console.log(`video=${urls.video}`);
    console.log(`poster=${urls.poster}`);
    console.log(`\nWrote ${FRONTEND_ENV}`);
}

main().catch((err) => {
    console.error('Hero video upload failed:', err?.message || err);
    process.exitCode = 1;
});
