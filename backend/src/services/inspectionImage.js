import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../utils/AppError.js';
import { GRID_SIZE, assessQuality } from '../../../Damage AI Inspection/vision.js';

export const INSPECTION_ANGLES = ['front', 'rear', 'left', 'right', 'windshield', 'interior'];
const TYPES = ['scratch', 'dent', 'crack', 'chip', 'broken', 'missing'];
const SEVERITIES = ['minor', 'moderate', 'severe'];
export async function prepareEvidence(images) {
  if (!Array.isArray(images) || images.length !== 6) throw new AppError('Capture all six vehicle views.', 400);
  const angles = new Set(), hashes = new Set();
  const prepared = [];
  // Sequential decoding limits CPU/memory pressure from an untrusted batch.
  for (const image of images) {
    if (!image || !INSPECTION_ANGLES.includes(image.angle) || angles.has(image.angle)) throw new AppError('Each view must appear once.', 400);
    angles.add(image.angle);
    if (typeof image.url !== 'string' || image.url.length > 1400000) throw new AppError('Each image must be under 1 MB.', 400);
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.url);
    if (!match || match[2].length % 4) throw new AppError('Provide JPEG or PNG image data.', 400);
    const original = Buffer.from(match[2], 'base64');
    if (original.length > 1024*1024 || original.length < 32) throw new AppError('Invalid image size.', 400);
    const sha256 = createHash('sha256').update(original).digest('hex');
    if (hashes.has(sha256)) throw new AppError('Capture a separate photo for each view.', 400);
    hashes.add(sha256);
    if (!['not_reported','no_visible_damage','damage_reported'].includes(image.condition)) throw new AppError('Record each view condition.', 400);
    const findings = image.findings || [];
    if (!Array.isArray(findings) || findings.length > 10 || (image.condition === 'damage_reported') !== (findings.length > 0)) throw new AppError('Condition and damage notes must match.', 400);
    const damages = findings.map(finding => {
      if (!finding || !TYPES.includes(finding.type) || !SEVERITIES.includes(finding.severity) || typeof finding.note !== 'string' || !finding.note.trim() || finding.note.length > 500) throw new AppError('Add a valid damage type, severity and location note.', 400);
      return { id: randomUUID(), part: image.angle, type: finding.type, severity: finding.severity, note: finding.note.trim(), source: 'user_reported' };
    });
    try {
      const decoder = sharp(original, { limitInputPixels: 16*1024*1024, failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (!['jpeg','png'].includes(metadata.format) || metadata.format !== match[1] || metadata.pages > 1 || metadata.width < 320 || metadata.height < 240) throw new Error('Invalid format or dimensions');
      // Re-encode for display: strip EXIF/location and other embedded metadata.
      const display = await decoder.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#fff' }).jpeg({ quality: 78 }).toBuffer();
      const displayMetadata = await sharp(display).metadata();
      const pixels = await sharp(display).resize(GRID_SIZE, GRID_SIZE, { fit: 'fill' }).greyscale().raw().toBuffer();
      prepared.push({ original, display, metadata: { id: randomUUID(), angle: image.angle, sha256, condition: image.condition,
        damages, width: displayMetadata.width, height: displayMetadata.height, aspectRatio: displayMetadata.width/displayMetadata.height,
        descriptor: pixels.toString('base64'), quality: assessQuality(pixels) } });
    } catch {
      throw new AppError('An image could not be decoded safely. Retake it as a JPEG/PNG at least 320 × 240.', 400);
    }
  }
  return prepared;
}
