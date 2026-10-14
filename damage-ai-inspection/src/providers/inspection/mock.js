import { randomUUID } from 'node:crypto';

/**
 * Deterministic mock inspection provider. Lets the whole workflow run and be
 * tested without FocalX. It reads "damage" from a convention on the image list:
 * any image whose `angle` or `url` contains a tag like "[dent:left-door:moderate]"
 * is reported as that finding. No tags -> a clean vehicle.
 *
 * Swap this for the FocalX adapter by setting INSPECTION_PROVIDER=focalx.
 */
const TAG = /\[(scratch|dent|crack|chip|broken|missing):([a-z0-9-]+):(minor|moderate|severe)\]/gi;

function readTags(images) {
  const findings = [];
  for (const img of images) {
    const hay = `${img.angle || ''} ${img.url || ''}`;
    let m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(hay)) !== null) {
      findings.push({
        id: randomUUID(),
        type: m[1].toLowerCase(),
        part: m[2].toLowerCase(),
        severity: m[3].toLowerCase(),
        confidence: 0.92,
        imageUrl: img.url,
      });
    }
  }
  return findings;
}

/** @type {import('../../types.js').InspectionProvider} */
export const mockInspectionProvider = {
  name: 'mock',
  async inspect({ vehicle, stage, images }) {
    return {
      providerInspectionId: `mock_${randomUUID()}`,
      provider: 'mock',
      stage,
      vehicle,
      damages: readTags(images),
      completedAt: new Date().toISOString(),
      reportUrl: null,
    };
  },
};
