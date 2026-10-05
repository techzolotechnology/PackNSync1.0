import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VEHICLE_UPLOAD_DIR = path.join(__dirname, '../../uploads/vehicles');

if (!fs.existsSync(VEHICLE_UPLOAD_DIR)) {
    fs.mkdirSync(VEHICLE_UPLOAD_DIR, { recursive: true });
}

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VEHICLE_UPLOAD_DIR),
    filename: (req, file, cb) => {
        // Extension from the validated mimetype, never the client filename (no .html uploads).
        const ext = MIME_EXT[file.mimetype] || '.jpg';
        cb(null, `${req.user.id}_${Date.now()}${ext}`);
    },
});

export const vehicleImageUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(Object.assign(new Error('Upload JPG, PNG, or WEBP only.'), { statusCode: 400 }));
    },
});
