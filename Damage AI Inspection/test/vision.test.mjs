import test from 'node:test';
import assert from 'node:assert/strict';
import { assessQuality, compareViews, GRID_SIZE } from '../vision.js';
function pixels() {
  return Buffer.from(Array.from({ length: GRID_SIZE**2 }, (_,i) => 50 + ((i*19 + Math.floor(i/GRID_SIZE)*23) % 150)));
}
function view(data, angle = 'front') { return { angle, descriptor: data.toString('base64'), aspectRatio: 4/3, quality: assessQuality(data) }; }
test('quality warns on dark, overexposed and low-texture images', () => {
  assert.ok(assessQuality(Buffer.alloc(GRID_SIZE**2, 0)).warnings.includes('too_dark'));
  assert.ok(assessQuality(Buffer.alloc(GRID_SIZE**2, 255)).warnings.includes('overexposed'));
  assert.ok(assessQuality(Buffer.alloc(GRID_SIZE**2, 120)).warnings.includes('blur_or_low_texture'));
  assert.deepEqual(assessQuality(pixels()).warnings, []);
});
test('identical views are similar, without asserting clean vehicle', () => {
  const report = compareViews(view(pixels()), view(pixels()));
  assert.equal(report.status, 'similar'); assert.equal(report.changedFraction, 0);
  assert.match(report.reason, /human review/);
});
test('localized changes generate normalized review regions', () => {
  const before = pixels(), after = Buffer.from(before);
  for (let y=35; y<55; y++) for (let x=35; x<55; x++) after[y*GRID_SIZE+x] = 250;
  const report = compareViews(view(before), view(after));
  assert.equal(report.status, 'visual_change'); assert.ok(report.regions.length);
  for (const region of report.regions) assert.ok(region.x >= 0 && region.x + region.width <= 1);
});
test('bad quality, missing baseline and mismatched framing are inconclusive', () => {
  assert.equal(compareViews(null, view(pixels())).status, 'inconclusive');
  assert.equal(compareViews(view(pixels()), view(Buffer.alloc(GRID_SIZE**2))).status, 'inconclusive');
  assert.equal(compareViews(view(pixels()), { ...view(pixels()), aspectRatio: 2 }).status, 'inconclusive');
});
test('small illumination change does not falsely become damage finding', () => {
  const before = pixels(), after = Buffer.from(before.map(value => value + 10));
  const report = compareViews(view(before), view(after));
  assert.equal(report.status, 'similar'); assert.equal(report.algorithm, 'local-change-v1');
});
