import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { prepareEvidence } from '../../backend/src/services/inspectionImage.js';
const angles = ['front','rear','left','right','windshield','interior'];
async function makeImages() {
  const images = [];
  for (let seed=0; seed<6; seed++) {
    const pixels = Buffer.from(Array.from({length:320*240*3},(_,i) => (i*17 + seed*31 + Math.floor(i/960)*7)%256));
    const bytes = await sharp(pixels,{raw:{width:320,height:240,channels:3}}).png().toBuffer();
    images.push({angle:angles[seed],url:`data:image/png;base64,${bytes.toString('base64')}`,condition:'no_visible_damage',findings:[]});
  }
  return images;
}
test('fully decodes real photos, strips metadata and returns a local descriptor', async () => {
  const images = await prepareEvidence(await makeImages());
  assert.equal(images.length,6);
  assert.equal(images[0].metadata.descriptor.length,12288);
  const metadata = await sharp(images[0].display).metadata();
  assert.equal(metadata.format,'jpeg'); assert.equal(metadata.exif,undefined);
  assert.equal(images[0].metadata.sha256.length,64);
});
test('corrupt image, mislabeled type and reused view fail safely', async () => {
  for (const mode of ['corrupt','mislabeled','duplicate']) {
    const images = await makeImages();
    if (mode==='corrupt') images[0].url=`data:image/png;base64,${Buffer.alloc(100).toString('base64')}`;
    if (mode==='mislabeled') images[0].url=images[0].url.replace('image/png','image/jpeg');
    if (mode==='duplicate') images[1].url=images[0].url;
    await assert.rejects(prepareEvidence(images),{statusCode:400});
  }
});
test('malformed condition notes and hostile image URLs fail before decoding', async () => {
  const images=await makeImages(); images[0].url='https://127.0.0.1/private';
  await assert.rejects(prepareEvidence(images),{statusCode:400});
  const notes=await makeImages(); notes[0].condition='damage_reported'; notes[0].findings=[{type:'scratch',severity:'minor',note:'  '}];
  await assert.rejects(prepareEvidence(notes),{statusCode:400});
});
test('scratch notes can be skipped without asserting the vehicle is damage-free', async () => {
  const photos=await makeImages();
  for (const photo of photos) photo.condition='not_reported';
  const result=await prepareEvidence(photos);
  assert.ok(result.every(photo=>photo.metadata.condition==='not_reported' && photo.metadata.damages.length===0));
});
test('an optional scratch note stays attached to its vehicle photo', async () => {
  const photos=await makeImages();
  photos[0].condition='damage_reported';
  photos[0].findings=[{type:'scratch',severity:'minor',note:'Below the left headlight'}];
  const result=await prepareEvidence(photos);
  assert.equal(result[0].metadata.angle,'front');
  assert.equal(result[0].metadata.damages[0].note,'Below the left headlight');
  assert.equal(result[1].metadata.damages.length,0);
  photos[0].condition='not_reported';
  await assert.rejects(prepareEvidence(photos),{statusCode:400});
});
