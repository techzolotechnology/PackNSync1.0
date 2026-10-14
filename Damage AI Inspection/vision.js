// PickAndSync local visual-change aid. This is not a trained damage classifier.
export const GRID_SIZE = 96;
export function assessQuality(pixels, size = GRID_SIZE) {
  let total = 0, dark = 0, bright = 0, lapSum = 0, lapSquared = 0, count = 0;
  for (const value of pixels) { total += value; dark += value < 12; bright += value > 243; }
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = y * size + x;
    const lap = pixels[i-1] + pixels[i+1] + pixels[i-size] + pixels[i+size] - 4*pixels[i];
    lapSum += lap; lapSquared += lap*lap; count++;
  }
  const sharpness = Math.max(0, lapSquared/count - (lapSum/count)**2);
  const mean = total/pixels.length;
  const warnings = [];
  if (mean < 25 || dark/pixels.length > 0.65) warnings.push('too_dark');
  if (mean > 235 || bright/pixels.length > 0.65) warnings.push('overexposed');
  if (sharpness < 15) warnings.push('blur_or_low_texture');
  return { meanBrightness: Math.round(mean), sharpness: Math.round(sharpness), warnings };
}

export function compareViews(before, after) {
  const result = { angle: after.angle, status: 'inconclusive', changedFraction: null, regions: [], algorithm: 'local-change-v1' };
  if (!before || before.quality.warnings.length || after.quality.warnings.length) return { ...result, reason: 'Capture quality needs review.' };
  if (Math.abs(before.aspectRatio - after.aspectRatio) > 0.15) return { ...result, reason: 'Camera framing differs.' };
  const a = Buffer.from(before.descriptor, 'base64'), b = Buffer.from(after.descriptor, 'base64');
  const size = GRID_SIZE;
  if (a.length !== size*size || b.length !== size*size) return { ...result, reason: 'Comparison data unavailable.' };
  // Limited translation search; not perspective/vehicle-panel registration.
  let best = { score: Infinity, dx: 0, dy: 0, offset: 0 };
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    let delta = 0, n = 0;
    for (let y = 5; y < size-5; y+=2) for (let x = 5; x < size-5; x+=2) { delta += b[(y+dy)*size+x+dx] - a[y*size+x]; n++; }
    const offset = delta/n;
    let error = 0;
    for (let y = 5; y < size-5; y+=2) for (let x = 5; x < size-5; x+=2) error += Math.abs(b[(y+dy)*size+x+dx] - a[y*size+x] - offset);
    if (error/n < best.score) best = { score: error/n, dx, dy, offset };
  }
  if (best.score > 48 || Math.abs(best.offset) > 60) return { ...result, reason: 'Viewpoint or lighting differs too much.' };
  let changed = 0, total = 0;
  const tiles = new Map();
  for (let y = 5; y < size-5; y++) for (let x = 5; x < size-5; x++) {
    const difference = Math.abs(b[(y+best.dy)*size+x+best.dx] - a[y*size+x] - best.offset);
    total++;
    if (difference > 35) {
      changed++;
      const key = `${Math.floor(x/12)}:${Math.floor(y/12)}`;
      tiles.set(key, (tiles.get(key) || 0)+1);
    }
  }
  const fraction = changed/total;
  if (fraction > 0.4) return { ...result, reason: 'Widespread image differences; compare manually.' };
  const regions = [...tiles].filter(([,count]) => count >= 18).slice(0, 24).map(([key]) => {
    const [x,y] = key.split(':').map(Number);
    return { x: x/8, y: y/8, width: 1/8, height: 1/8 };
  });
  return { ...result, status: fraction > 0.015 ? 'visual_change' : 'similar', changedFraction: Math.round(fraction*10000)/10000,
    regions, reason: 'Visual differences may be damage, dirt, reflections or scene changes; human review required.' };
}
