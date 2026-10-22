// Opt-in only: isolated localhost inspection_test database, no live APIs.
import assert from 'node:assert/strict';
import sharp from 'sharp';
const connection=process.env.INSPECTION_TEST_DATABASE_URL;
if (!connection) throw new Error('Provide an isolated localhost inspection_test database.');
const parsed=new URL(connection);
if (!['localhost','127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/inspection_test') throw new Error('Remote/non-test database rejected.');
process.env.DATABASE_URL=connection;
process.env.JWT_SECRET='local-inspection-test-key-not-production';
process.env.JWT_REFRESH_SECRET='local-inspection-refresh-key-not-production';
process.env.ADMIN_MFA_REQUIRED='true';
process.env.INSPECTIONS_ENABLED='true';
process.env.NODE_ENV='production';
await import('express-async-errors');
const {default:express}=await import('express');
const {default:jwt}=await import('jsonwebtoken');
const {default:cookieParser}=await import('cookie-parser');
const {prisma:db}=await import('../../backend/src/utils/prisma.js');
const {rentalRouter}=await import('../../backend/src/routes/rental.routes.js');
const {adminRouter}=await import('../../backend/src/routes/admin.routes.js');
const {errorHandler}=await import('../../backend/src/middleware/error.middleware.js');
const app=express(); app.use(express.json({limit:'10mb'})); app.use(cookieParser()); app.use('/api/rentals',rentalRouter); app.use('/api/admin',adminRouter); app.use(errorHandler);
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const ids=[]; let booking;
function token(user,mfa=false) { return jwt.sign({sub:user.id,...(mfa?{mfaAt:Date.now()}: {})},process.env.JWT_SECRET,{expiresIn:'10m'}); }
async function request(path,auth,method='GET',body) {
  return fetch(`${origin}/api${path}`,{method,headers:{...(auth?{Authorization:`Bearer ${auth}`} : {}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
}
async function images() {
  const result=[];
  for (const [i,angle] of ['front','rear','left','right','windshield','interior'].entries()) {
    const pixels=Buffer.from(Array.from({length:320*240*3},(_,j)=>(j*23+i*19+Math.floor(j/960)*11)%256));
    const bytes=await sharp(pixels,{raw:{width:320,height:240,channels:3}}).jpeg().toBuffer();
    result.push({angle,url:`data:image/jpeg;base64,${bytes.toString('base64')}`,condition:'no_visible_damage',findings:[]});
  }
  return result;
}
try {
  const host=await db.user.create({data:{name:'HTTP test host'}}); ids.push(host.id);
  const renter=await db.user.create({data:{name:'HTTP test renter'}}); ids.push(renter.id);
  const other=await db.user.create({data:{name:'HTTP test other'}}); ids.push(other.id);
  const admin=await db.user.create({data:{name:'HTTP test admin',role:'ADMIN',totpEnabled:true}}); ids.push(admin.id);
  const vehicle=await db.vehicle.create({data:{ownerId:host.id,make:'Test',model:'Car',year:2025,licensePlate:`HTTP-${Date.now()}`,seats:4,fuelType:'PETROL',transmission:'MANUAL',images:[]}});
  const listing=await db.rentalListing.create({data:{hostId:host.id,vehicleId:vehicle.id,pricePerDay:1000,location:'Local test',availableFrom:new Date('2026-01-01'),availableTo:new Date('2027-01-01')}});
  booking=await db.rentalBooking.create({data:{listingId:listing.id,renterId:renter.id,startDate:new Date('2026-10-10'),endDate:new Date('2026-10-11'),totalPrice:1020,status:'PAID'}});
  await db.hostEarning.create({data:{bookingId:booking.id,hostId:host.id,amount:1000,releaseAt:new Date()}});
  const base=`/rentals/bookings/${booking.id}/inspection`;
  assert.equal((await request(base)).status,401);
  assert.equal((await request(base,token(other))).status,403);
  const captured=await images();
  assert.equal((await request(`${base}/checkin`,token(renter),'POST',{images:captured})).status,400);
  let response=await request(`${base}/checkin`,token(renter),'POST',{images:captured,consent:true}); assert.equal(response.status,201);
  const report=(await response.json()).data;
  const imagePath=report.checkin.images[0].url;
  const opaque=await fetch(`${origin}/api${imagePath}`,{headers:{Origin:'null',Cookie:`access_token=${token(renter)}`}});
  assert.equal(opaque.status,403);
  response=await request(imagePath,token(renter)); assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),'image/jpeg'); assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal((await request(imagePath,token(other))).status,403);
  assert.equal((await request('/admin/inspections',token(admin))).status,403);
  assert.equal((await request('/admin/inspections',token(admin,true))).status,200);
  assert.equal((await request(base,token(admin))).status,403);
  assert.equal((await request(`${base}/confirm`,token(host),'POST',{stage:'checkin'})).status,200);
  response=await request(`${base}/dispute`,token(renter),'POST',{reason:'HTTP test dispute needs investigation'}); assert.equal(response.status,200);
  const disputed=(await response.json()).data;
  assert.ok(disputed.reportId);
  response=await request(`/admin/reports/${disputed.reportId}`,token(admin,true),'PATCH',{status:'RESOLVED',resolution:'Local test closure'}); assert.equal(response.status,200);
  // A reply to a closed report must not reopen it using stale OPEN state.
  response=await request(`/admin/reports/${disputed.reportId}/messages`,token(admin,true),'POST',{body:'Support reply on the closed test report'}); assert.equal(response.status,201);
  assert.equal((await db.report.findUnique({where:{id:disputed.reportId}})).status,'RESOLVED');
  await db.hostEarning.update({where:{bookingId:booking.id},data:{status:'PENDING',note:null}});
  response=await request(`/admin/reports/${disputed.reportId}`,token(admin,true),'PATCH',{status:'OPEN'}); assert.equal(response.status,200);
  const reopened=await db.rentalInspection.findUnique({where:{bookingId:booking.id}});
  assert.equal(reopened.reviewStatus,'DISPUTED'); assert.ok(reopened.version>disputed.version);
  const earning=await db.hostEarning.findUnique({where:{bookingId:booking.id}});
  assert.equal(earning.status,'ON_HOLD'); assert.match(earning.note,/^Inspection/);
  assert.equal((await request(`${base}/export`,token(renter))).status,200);
  assert.equal((await request(`/rentals/bookings/${booking.id}/claim`,token(renter),'POST',{})).status,409);
  process.env.INSPECTIONS_ENABLED='false'; assert.equal((await request(base,token(renter))).status,503);
  console.log('PASS: HTTP auth, IDOR, MFA, consent, photo privacy, signoff, report reopen, export, disabled insurance and rollout switch.');
} finally {
  await new Promise(resolve=>server.close(resolve));
  if (booking) await db.rentalBooking.delete({where:{id:booking.id}});
  if (ids.length) await db.user.deleteMany({where:{id:{in:ids}}});
  await db.$disconnect();
}
