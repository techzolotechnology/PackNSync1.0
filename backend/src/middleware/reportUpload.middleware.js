import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Private: never served by express.static (see index.js). */
export const REPORT_UPLOAD_DIR = path.join(__dirname, '../../uploads/reports');

if (!fs.existsSync(REPORT_UPLOAD_DIR)) {
    fs.mkdirSync(REPORT_UPLOAD_DIR, { recursive: true });
}

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, REPORT_UPLOAD_DIR),
    // The uploader's id prefixes the name so ownership can be checked on download.
    filename: (req, file, cb) => cb(null, `${req.user.id}_${Date.now()}_${randomBytes(4).toString('hex')}${MIME_EXT[file.mimetype] || '.jpg'}`),
});

export const reportEvidenceUpload = multer({
    storage,
    limits: { fileSize: 6 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (MIME_EXT[file.mimetype]) return cb(null, true);
        cb(Object.assign(new Error('Upload photos as JPG, PNG, or WEBP.'), { statusCode: 400 }));
    },
});
