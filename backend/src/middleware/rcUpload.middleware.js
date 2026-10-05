import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RC_UPLOAD_DIR = path.join(__dirname, '../../uploads/rc');

if (!fs.existsSync(RC_UPLOAD_DIR)) {
    fs.mkdirSync(RC_UPLOAD_DIR, { recursive: true });
}

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RC_UPLOAD_DIR),
    filename: (req, file, cb) => {
        // Extension from the validated mimetype, never the client filename (no .html uploads).
        const ext = MIME_EXT[file.mimetype] || '.jpg';
        const safePlate = String(req.body?.licensePlate || 'rc').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        cb(null, `${req.user.id}_${safePlate}_${Date.now()}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Upload a clear RC photo (JPG, PNG, or WEBP). PDF not supported yet.'), { statusCode: 400 }));
};

export const rcUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 8 * 1024 * 1024 },
});
