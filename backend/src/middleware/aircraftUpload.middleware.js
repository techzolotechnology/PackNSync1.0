import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { RC_UPLOAD_DIR } from './rcUpload.middleware.js';

const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
export const aircraftUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, done) => done(null, RC_UPLOAD_DIR),
        filename: (_req, file, done) => done(null, `aircraft_${randomUUID()}${extensions[file.mimetype] || '.jpg'}`),
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, done) => extensions[file.mimetype]
        ? done(null, true)
        : done(Object.assign(new Error('Upload JPG, PNG or WEBP documents, up to 8 MB.'), { statusCode: 400 })),
});
