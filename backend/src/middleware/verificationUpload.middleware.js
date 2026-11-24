import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VERIFICATION_UPLOAD_DIR = path.join(__dirname, '../../uploads/verification');
fs.mkdirSync(VERIFICATION_UPLOAD_DIR, { recursive: true });

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export const verificationUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, done) => done(null, VERIFICATION_UPLOAD_DIR),
        filename: (_req, _file, done) => done(null, `${Date.now()}_${randomBytes(16).toString('hex')}.jpg`),
    }),
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (_req, file, done) => {
        if (MIME_EXT[file.mimetype]) return done(null, true);
        done(Object.assign(new Error('Upload a JPG, PNG, or WEBP document image.'), { statusCode: 400 }));
    },
});

export async function sanitizeVerificationUpload(filePath) {
    const temporaryPath = `${filePath}.sanitized`;
    try {
        await sharp(filePath, { failOn: 'error', limitInputPixels: 40000000 })
            .rotate()
            .jpeg({ quality: 88 })
            .toFile(temporaryPath);
        fs.renameSync(temporaryPath, filePath);
    } catch {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        throw Object.assign(new Error('The uploaded file is not a valid document image.'), { statusCode: 400 });
    }
}

export function removeVerificationUpload(url) {
    const value = String(url || '');
    const filename = value.startsWith('/api/admin/verification-files/')
        ? value.slice('/api/admin/verification-files/'.length)
        : value;
    if (!/^\d+_[a-f0-9]{32}\.jpg$/.test(filename)) return;
    const target = path.join(VERIFICATION_UPLOAD_DIR, filename);
    if (fs.existsSync(target)) fs.unlinkSync(target);
}
