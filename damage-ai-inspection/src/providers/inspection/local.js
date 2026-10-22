import { createHash, randomUUID } from 'node:crypto';

export const REQUIRED_ANGLES = ['front', 'rear', 'left', 'right', 'windshield', 'interior'];
const TYPES = ['scratch', 'dent', 'crack', 'chip', 'broken', 'missing'];
const SEVERITIES = ['minor', 'moderate', 'severe'];
function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

// Owned evidence intake. It never infers damage from filenames, URLs or pixels.
export const localInspectionProvider = {
  name: 'pickandsync-local',
  async inspect({ bookingId, vehicle, stage, images }) {
    if (!Array.isArray(images) || images.length !== REQUIRED_ANGLES.length) invalid('Capture all six vehicle views.');
    const seen = new Set();
    const evidence = images.map(image => {
      if (!image || !REQUIRED_ANGLES.includes(image.angle) || seen.has(image.angle)) invalid('Each vehicle view must appear exactly once.');
      seen.add(image.angle);
      const match = typeof image.url === 'string' && /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.url);
      if (!match || match[2].length % 4 !== 0) invalid('Use a captured JPEG or PNG, not an external URL.');
      const bytes = Buffer.from(match[2], 'base64');
      const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      if (bytes.length < 32 || bytes.length > 1024 * 1024 || !(match[1] === 'jpeg' ? jpeg : png)) invalid('Invalid image or image exceeds 1 MB.');
      if (image.condition !== 'no_visible_damage' && image.condition !== 'damage_reported') invalid('Record the visible condition for every view.');
      const findings = image.findings || [];
      if (!Array.isArray(findings) || findings.length > 10) invalid('Too many damage notes.');
      if ((image.condition === 'damage_reported') !== (findings.length > 0)) invalid('Damage notes must match the recorded condition.');
      const damages = findings.map(finding => {
        if (!finding || !TYPES.includes(finding.type) || !SEVERITIES.includes(finding.severity)) invalid('Invalid damage type or severity.');
        if (typeof finding.note !== 'string' || finding.note.length > 500) invalid('Damage note must be at most 500 characters.');
        return { id: randomUUID(), part: image.angle, type: finding.type, severity: finding.severity, note: finding.note, source: 'user_reported', confidence: 1 };
      });
      return { angle: image.angle, url: image.url, sha256: createHash('sha256').update(bytes).digest('hex'), condition: image.condition, damages };
    });
    if (new Set(evidence.map(item => item.sha256)).size !== evidence.length) invalid('Use a different photo for each view.');
    return {
      provider: this.name, providerInspectionId: randomUUID(), bookingId, vehicle, stage,
      completedAt: new Date().toISOString(), images: evidence,
      damages: evidence.flatMap(image => image.damages), reviewStatus: 'pending_review',
      automatedDetection: false, reportUrl: null,
    };
  },
};
