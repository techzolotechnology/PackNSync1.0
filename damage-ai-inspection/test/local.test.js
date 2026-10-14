import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDamageInspectionService, createFileStore } from '../src/index.js';
import { getInspectionProvider } from '../src/providers/inspection/index.js';
const vehicle = { vehicleId: 'car-1' };
const images = () => ['front', 'rear', 'left', 'right', 'windshield', 'interior'].map((angle, index) => ({
  angle, url: `data:image/jpeg;base64,${Buffer.concat([Buffer.from([255,216,255]), Buffer.alloc(40, index)]).toString('base64')}`,
  condition: 'no_visible_damage', findings: [],
}));
const params = () => ({ bookingId: 'booking-1', vehicle, images: images() });

test('owned provider is always selected even with old external configuration', () => {
  assert.equal(getInspectionProvider('focalx').name, 'pickandsync-local');
});
test('records evidence and fingerprints without claiming computer vision', async () => {
  const result = await getInspectionProvider().inspect({ ...params(), stage: 'checkin' });
  assert.equal(result.automatedDetection, false);
  assert.equal(result.images.length, 6);
  assert.equal(result.images[0].sha256.length, 64);
  assert.deepEqual(result.damages, []);
});
test('rejects remote URLs, missing views, duplicate photos and forged media', async () => {
  const invalidSets = [images().slice(1), images().map(image => ({ ...image, url: 'https://example.com/a.jpg' })),
    images().map(image => ({ ...image, url: images()[0].url })),
    images().map(image => ({ ...image, url: `data:image/jpeg;base64,${Buffer.alloc(40).toString('base64')}` }))];
  for (const set of invalidSets) await assert.rejects(getInspectionProvider().inspect({ ...params(), images: set }), { statusCode: 400 });
});
test('ignores neither malformed condition nor invalid damage notes', async () => {
  const set = images(); set[0].condition = 'damage_reported';
  await assert.rejects(getInspectionProvider().inspect({ ...params(), images: set }), { statusCode: 400 });
});
test('return requires matching pickup and vehicle', async () => {
  const service = createDamageInspectionService();
  await assert.rejects(service.recordCheckout(params()), { statusCode: 409 });
  await service.recordCheckin(params());
  await assert.rejects(service.recordCheckout({ ...params(), vehicle: { vehicleId: 'car-2' } }), { statusCode: 409 });
});
test('condition changes stay pending review without invented costs or payouts', async () => {
  const service = createDamageInspectionService();
  await service.recordCheckin(params());
  const set = images(); set[0].condition = 'damage_reported';
  set[0].findings = [{ type: 'scratch', severity: 'minor', note: 'Below number plate' }];
  const result = await service.recordCheckout({ ...params(), images: set, autoClaim: true });
  assert.equal(result.newDamages.length, 1);
  assert.equal(result.estimate.status, 'quote_required');
  assert.equal(result.claim, null);
  assert.equal((await service.getReport('booking-1')).summary.status, 'pending_review');
  await assert.rejects(service.fileClaim({ bookingId: 'booking-1' }), { statusCode: 409 });
});
test('pickup and return cannot be replaced', async () => {
  const service = createDamageInspectionService();
  await service.recordCheckin(params());
  await assert.rejects(service.recordCheckin(params()), { statusCode: 409 });
  await service.recordCheckout(params());
  await assert.rejects(service.recordCheckout(params()), { statusCode: 409 });
});
test('file store persists evidence and refuses overwrites or corrupt stores', async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'pns-evidence-'));
  try {
    const filename = path.join(directory, 'evidence.json');
    const store = createFileStore(filename);
    await store.saveInspection('b', 'checkin', { value: 1 });
    assert.equal((await createFileStore(filename).getInspection('b', 'checkin')).value, 1);
    await assert.rejects(store.saveInspection('b', 'checkin', { value: 2 }), { statusCode: 409 });
    writeFileSync(filename, 'corrupt');
    await assert.rejects(store.getInspection('b', 'checkin'));
  } finally { rmSync(directory, { recursive: true }); }
});
