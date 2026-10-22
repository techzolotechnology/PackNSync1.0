// Deliberately opt-in. Never accepts a production/remote database URL.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { createInspectionWorkflow } from '../workflow.js';
import { prepareEvidence } from '../../backend/src/services/inspectionImage.js';
const connection = process.env.INSPECTION_TEST_DATABASE_URL;
if (!connection) throw new Error('Set INSPECTION_TEST_DATABASE_URL to an isolated localhost inspection_test database.');
const parsed = new URL(connection);
if (!['localhost','127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/inspection_test') throw new Error('Only a localhost database named inspection_test is allowed.');
const db = new PrismaClient({datasources:{db:{url:connection}}});
process.env.DATABASE_URL = connection;
process.env.DISABLE_SWEEPS = 'true';
const { releaseEarning } = await import('../../backend/src/utils/hostEarnings.js');
const workflow = createInspectionWorkflow({db,prepareEvidence});
const ids = [];
let booking;
async function capture(stage) {
  const images=[];
  for (const [i,angle] of ['front','rear','left','right','windshield','interior'].entries()) {
    const data=Buffer.from(Array.from({length:320*240*3},(_,j) => (j*17+i*19+stage*13+Math.floor(j/960)*7)%256));
    const bytes=await sharp(data,{raw:{width:320,height:240,channels:3}}).jpeg().toBuffer();
    images.push({angle,url:`data:image/jpeg;base64,${bytes.toString('base64')}`,condition:'no_visible_damage',findings:[]});
  }
  return {consent:true,images,odometer:100+stage*20,fuelPercent:80-stage*10};
}
try {
  const host=await db.user.create({data:{name:'Inspection test host'}}); ids.push(host.id);
  const renter=await db.user.create({data:{name:'Inspection test renter'}}); ids.push(renter.id);
  const admin=await db.user.create({data:{name:'Inspection test reviewer',role:'ADMIN'}}); ids.push(admin.id);
  const vehicle=await db.vehicle.create({data:{ownerId:host.id,make:'Test',model:'Car',year:2025,licensePlate:`INS-${Date.now()}`,seats:4,fuelType:'PETROL',transmission:'MANUAL',images:[]}});
  const listing=await db.rentalListing.create({data:{hostId:host.id,vehicleId:vehicle.id,pricePerDay:1000,location:'Local test',availableFrom:new Date('2026-01-01'),availableTo:new Date('2027-01-01')}});
  booking=await db.rentalBooking.create({data:{listingId:listing.id,renterId:renter.id,startDate:new Date('2026-10-10'),endDate:new Date('2026-10-11'),totalPrice:1020,status:'PAID'}});
  const earning=await db.hostEarning.create({data:{bookingId:booking.id,hostId:host.id,amount:1000,releaseAt:new Date()}});
  const r={id:renter.id,role:'USER'},h={id:host.id,role:'USER'},a={id:admin.id,role:'ADMIN'};
  const pickup=await capture(0);
  await Promise.all([workflow.submit(booking.id,'checkin',pickup,r),workflow.submit(booking.id,'checkin',pickup,r)]);
  assert.equal(await db.inspectionImage.count(),6);
  assert.equal((await db.hostEarning.findUnique({where:{bookingId:booking.id}})).status,'ON_HOLD');
  await assert.rejects(releaseEarning(earning.id),{statusCode:409});
  await workflow.confirm(booking.id,{stage:'checkin'},h);
  await workflow.submit(booking.id,'checkout',await capture(1),r);
  await workflow.confirm(booking.id,{stage:'checkout'},h);
  let report=await workflow.getReport(booking.id,a);
  assert.equal(report.hasCheckout,true); assert.equal(report.events.length,4);
  const photo=await workflow.getImage(booking.id,report.checkin.images[0].id,r);
  assert.equal((await sharp(photo.display).metadata()).format,'jpeg');
  await assert.rejects(workflow.getReport(booking.id,{id:'intruder',role:'USER'}),{statusCode:403});
  const disputed=await workflow.dispute(booking.id,{reason:'Testing inspection dispute creation'},r);
  await assert.rejects(workflow.review(booking.id,{decision:'PASSED',expectedVersion:report.version,reason:'Stale review must be rejected'},a),{statusCode:409});
  report=await workflow.review(booking.id,{decision:'PASSED',expectedVersion:disputed.version,reason:'Both parties acknowledged clear evidence'},a);
  assert.equal(report.reviewStatus,'PASSED');
  assert.equal((await db.hostEarning.findUnique({where:{bookingId:booking.id}})).status,'PENDING');
  assert.equal((await db.report.findUnique({where:{id:disputed.reportId}})).status,'RESOLVED');
  assert.equal(await db.walletTransaction.count(),0);
  await releaseEarning(earning.id);
  await assert.rejects(releaseEarning(earning.id),{statusCode:409});
  assert.equal((await db.wallet.findUnique({where:{userId:host.id}})).balance,1000);
  assert.equal(await db.walletTransaction.count(),1);
  console.log('PASS: PostgreSQL evidence, concurrent retries, signoff, private images, dispute, stale review, audit, payout block and exactly-once release in local test database.');
} finally {
  if (booking) await db.rentalBooking.delete({where:{id:booking.id}});
  if (ids.length) await db.user.deleteMany({where:{id:{in:ids}}});
  await db.$disconnect();
}
