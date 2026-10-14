import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspectionWorkflow } from '../workflow.js';
const actor = id => ({ id, role: id === 'admin' ? 'ADMIN' : 'USER' });
function setup() {
  let record = null; const events = []; const photos = []; const reports = [];
  const booking = { id: 'b', status: 'PAID', renterId: 'renter', listing: { hostId: 'host', host: { id: 'host', name: 'Host' }, vehicle: { id: 'car', make: 'Example', model: 'Car', type: 'CAR', rcUrl: 'private' } }, renter: { id: 'renter', name: 'Renter' } };
  const earning = { status: 'PENDING', note: null };
  let queue = Promise.resolve();
  const db = {
    $queryRaw: async () => [],
    rentalBooking: { findUnique: async ({where}) => where.id === 'b' ? structuredClone(booking) : null },
    rentalInspection: {
      findUnique: async () => record ? { ...structuredClone(record), events: structuredClone(events) } : null,
      create: async ({data}) => { record = { id: 'inspection', version: 1, ...structuredClone(data) }; return structuredClone(record); },
      update: async ({data}) => { record = { ...record, ...structuredClone(data), version: data.version ? record.version+1 : record.version }; return structuredClone(record); },
      findMany: async () => [],
    },
    inspectionImage: { createMany: async ({data}) => photos.push(...data), findFirst: async ({where}) => photos.find(image => image.id === where.id && where.inspection.bookingId === 'b') || null },
    inspectionEvent: { create: async ({data}) => events.push({ id: String(events.length), ...data }) },
    hostEarning: { updateMany: async ({where,data}) => {
      if (earning.status !== where.status || (where.note && !earning.note?.startsWith(where.note.startsWith))) return {count:0};
      Object.assign(earning,data); return {count:1};
    } },
    report: {
      create: async ({data}) => { const report = {id: `report-${reports.length}`, ...data}; reports.push(report); return report; },
      findUnique: async ({where}) => reports.find(report => report.id === where.id),
      update: async ({where,data}) => Object.assign(reports.find(report => report.id === where.id),data),
      count: async () => reports.filter(report => ['OPEN','IN_REVIEW'].includes(report.status)).length,
    },
    reportMessage: { create: async () => ({}) },
    $transaction: async callback => {
      const run = queue.then(() => callback(db)); queue = run.catch(() => {}); return run;
    },
  };
  const prepareEvidence = async input => input.map((image,index) => ({ original: Buffer.from('test'), display: Buffer.from('test'), metadata: {
    id: `image-${image.angle}-${image.sha || 'a'}`, angle: image.angle, sha256: image.sha || `hash-${index}`, condition: image.condition || 'no_visible_damage', damages: image.damages || [],
    descriptor: Buffer.alloc(96**2, 100).toString('base64'), quality: { warnings: ['blur_or_low_texture'] }, aspectRatio: 1,
  } }));
  const service = createInspectionWorkflow({db,prepareEvidence});
  const payload = { consent: true, images: ['front','rear','left','right','windshield','interior'].map(angle => ({angle})), odometer: 100, fuelPercent: 80 };
  async function completed() {
    await service.submit('b','checkin',payload,actor('renter'));
    await service.confirm('b',{stage:'checkin'},actor('host'));
    await service.submit('b','checkout',{...payload,odometer:150},actor('renter'));
    await service.confirm('b',{stage:'checkout'},actor('host'));
  }
  return {service,payload,completed,booking,earning,events,reports,photos};
}
test('unauthorized and unknown booking access fails', async () => {
  const {service} = setup();
  await assert.rejects(service.getReport('b',actor('stranger')), {statusCode:403});
  await assert.rejects(service.getReport('unknown',actor('renter')), {statusCode:404});
});
test('consent, paid status and valid numeric readings are mandatory', async () => {
  const {service,payload,booking} = setup();
  await assert.rejects(service.submit('b','checkin',{...payload,consent:false},actor('renter')), {statusCode:400});
  await assert.rejects(service.submit('b','checkin',{...payload,odometer:NaN},actor('renter')), {statusCode:400});
  await assert.rejects(service.submit('b','checkin',{...payload,fuelPercent:101},actor('renter')), {statusCode:400});
  booking.status = 'CANCELLED';
  await assert.rejects(service.submit('b','checkin',payload,actor('renter')), {statusCode:409});
});
test('return without pickup and reduced odometer fail', async () => {
  const {service,payload} = setup();
  await assert.rejects(service.submit('b','checkout',payload,actor('renter')), {statusCode:409});
  await service.submit('b','checkin',payload,actor('renter'));
  await assert.rejects(service.submit('b','checkout',{...payload,odometer:90},actor('renter')), {statusCode:400});
});
test('concurrent identical retries create one snapshot and six photos', async () => {
  const {service,payload,photos,events} = setup();
  await Promise.all([service.submit('b','checkin',payload,actor('renter')),service.submit('b','checkin',payload,actor('renter'))]);
  assert.equal(photos.length,6); assert.equal(events.length,1);
  await assert.rejects(service.submit('b','checkin',{...payload,odometer:101},actor('renter')), {statusCode:409});
});
test('snapshot metadata does not leak pixel descriptor or vehicle RC URL', async () => {
  const {service,payload} = setup();
  const report = await service.submit('b','checkin',payload,actor('renter'));
  assert.equal(report.checkin.images[0].descriptor,undefined);
  assert.equal(report.vehicle.rcUrl,undefined);
  assert.match(report.checkin.images[0].url,/inspection\/images/);
});
test('photo ownership is checked before reading evidence', async () => {
  const {service,payload,photos} = setup();
  await service.submit('b','checkin',payload,actor('renter'));
  await assert.rejects(service.getImage('b',photos[0].id,actor('stranger')), {statusCode:403});
  await assert.rejects(service.getImage('b','wrong',actor('renter')), {statusCode:404});
});
test('admin cannot submit or sign as a party', async () => {
  const {service,payload} = setup();
  await assert.rejects(service.submit('b','checkin',payload,actor('admin')), {statusCode:403});
  await service.submit('b','checkin',payload,actor('renter'));
  await assert.rejects(service.confirm('b',{stage:'checkin'},actor('admin')), {statusCode:403});
});
test('pass needs completed evidence and both-party signoff', async () => {
  const {service,payload} = setup();
  await service.submit('b','checkin',payload,actor('renter'));
  await service.submit('b','checkout',payload,actor('renter'));
  await assert.rejects(service.review('b',{decision:'PASSED',expectedVersion:4,reason:'Photos have been reviewed'},actor('admin')), {statusCode:409});
});
test('review pass clears only inspection hold and records audit without charging', async () => {
  const {service,completed,earning,events} = setup();
  await completed(); assert.equal(earning.status,'ON_HOLD');
  const report = await service.review('b',{decision:'PASSED',expectedVersion:4,reason:'Reviewed both photo sets and both confirmations'},actor('admin'));
  assert.equal(report.review.status,'PASSED'); assert.equal(earning.status,'PENDING');
  assert.equal(events.at(-1).action,'REVIEW'); assert.equal(report.claim,null);
});
test('unrelated booking dispute prevents unholding a passed inspection', async () => {
  const {service,completed,reports,earning} = setup(); await completed();
  reports.push({id:'unrelated',status:'OPEN'});
  await service.review('b',{decision:'PASSED',expectedVersion:4,reason:'Reviewed photo evidence, unrelated issue remains'},actor('admin'));
  assert.equal(earning.status,'ON_HOLD');
});
test('damage quote is recorded, not charged; subsequent dispute stays open', async () => {
  const {service,completed,earning,reports} = setup(); await completed();
  const report = await service.review('b',{decision:'DAMAGE_CONFIRMED',expectedVersion:4,reason:'Return photo has a visible new mark',quote:{total:1234.56,currency:'INR',workshop:'Test Workshop',reference:'Q-1'}},actor('admin'));
  assert.equal(report.review.quote.total,1234.56); assert.equal(earning.status,'ON_HOLD'); assert.equal(reports.length,1);
  const disputed = await service.dispute('b',{reason:'I disagree with the reported return mark'},actor('renter'));
  assert.equal(disputed.reviewStatus,'DISPUTED'); assert.equal(disputed.reportId,report.reportId);
});
test('invalid quotes, self-review and non-admin review are rejected', async () => {
  const {service,completed} = setup(); await completed();
  await assert.rejects(service.review('b',{decision:'DAMAGE_CONFIRMED',expectedVersion:4,reason:'Damage noted in photos',quote:{total:Infinity}},actor('admin')), {statusCode:400});
  await assert.rejects(service.review('b',{decision:'PASSED',expectedVersion:4,reason:'Photos reviewed'},actor('host')), {statusCode:403});
  await assert.rejects(service.review('b',{decision:'PASSED',expectedVersion:4,reason:'Photos reviewed'}, {id:'host',role:'ADMIN'}), {statusCode:403});
});
test('stale admin review cannot overwrite a newer customer dispute', async () => {
  const {service,completed} = setup(); await completed();
  await service.dispute('b',{reason:'The return finding needs further investigation'},actor('renter'));
  await assert.rejects(service.review('b',{decision:'PASSED',expectedVersion:4,reason:'Reviewed an older photo report'},actor('admin')),{statusCode:409});
  assert.equal((await service.getReport('b',actor('admin'))).reviewStatus,'DISPUTED');
});
