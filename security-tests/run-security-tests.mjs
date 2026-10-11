/**
 * PickAndSync API security test suite.
 *
 * Fires real attacks (auth bypass, IDOR/BOLA, privilege escalation, mass
 * assignment, SQL/object injection, stored XSS, payment tampering, forged
 * webhooks, rate limiting, CORS, headers) at a RUNNING API and reports, for
 * each case, whether the server behaved securely.
 *
 * SAFETY: run only against a local/staging server with a throwaway database.
 * It writes test users and fixtures and (by default) deletes them afterwards.
 * Never point it at production — attack payloads and rate-limit floods would
 * pollute real data.
 *
 *   SEC_BASE=http://localhost:5077 \
 *   DATABASE_URL=postgres://... \
 *   JWT_SECRET=<the server's JWT_SECRET> \
 *   node security-tests/run-security-tests.mjs
 *
 * Exits 0 when no high/critical case fails, 1 otherwise (CI-friendly).
 * Requires @prisma/client (generated) and jsonwebtoken — both already backend deps.
 */
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const BASE = (process.env.SEC_BASE || 'http://localhost:5077').replace(/\/$/, '');
const API = `${BASE}/api`;
const JWT_SECRET = process.env.JWT_SECRET;
const KEEP = process.env.SEC_KEEP === '1';

if (!JWT_SECRET) { console.error('Set JWT_SECRET to the server value.'); process.exit(2); }
if (/pickandsync\.com|api\.pickandsync/.test(BASE)) { console.error('Refusing to run against production.'); process.exit(2); }

const prisma = new PrismaClient();
const tag = `sectest_${Date.now()}`;
const sign = (userId, opts = {}) => jwt.sign({ sub: userId, ...opts.claims }, JWT_SECRET, { expiresIn: opts.expiresIn || '15m' });
const day = 86400000;
const seededUserIds = [];

const results = [];
const check = ({ id, name, category, severity, pass, detail }) => {
  results.push({ id, name, category, severity, pass: !!pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} ${name}${pass ? '' : `  -> ${detail || ''}`}`);
};

async function http(method, path, { token, body, headers = {}, origin } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = h['Content-Type'] || 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (origin) h.Origin = origin;
  const res = await fetch(`${API}${path}`, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }).catch((e) => ({ status: 0, _err: e }));
  if (res.status === 0) return res;
  let json = null; const text = await res.text();
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text, headers: res.headers };
}

// ---- fixtures -------------------------------------------------------------
async function makeUser({ key, role = 'USER', verified = false, banned = false, balance = 0, promo = 0 }) {
  const user = await prisma.user.create({
    data: {
      email: `${key}.${tag}@sectest.local`, name: `${key} user`, role,
      isBanned: banned, banReason: banned ? 'Seeded banned account' : null,
      referralCode: `${key.slice(0, 3).toUpperCase()}${Date.now().toString().slice(-6)}`,
    },
  });
  seededUserIds.push(user.id);
  await prisma.wallet.create({ data: { userId: user.id, balance, promoBalance: promo } });
  if (verified) {
    for (const documentType of ['DL', 'AADHAAR']) await prisma.verification.create({ data: { userId: user.id, documentType, status: 'VERIFIED', verifiedAt: new Date() } });
    for (const policyType of ['RENTAL_TERMS', 'LISTING_TERMS']) await prisma.policyAcceptance.create({ data: { userId: user.id, policyType, policyVersion: '1.0' } });
  }
  return user;
}

async function makeVehicleAndListing(owner, plate) {
  const vehicle = await prisma.vehicle.create({ data: { ownerId: owner.id, make: 'Test', model: 'Car', year: 2023, type: 'CAR', licensePlate: `${plate}${Date.now().toString().slice(-5)}`, seats: 5, fuelType: 'Petrol', transmission: 'Manual', images: [], isVerified: false } });
  const listing = await prisma.rentalListing.create({ data: { vehicleId: vehicle.id, hostId: owner.id, pricePerDay: 1000, location: 'Testville', availableFrom: new Date(Date.now() - day), availableTo: new Date(Date.now() + 30 * day), isActive: true } });
  return { vehicle, listing };
}

const makeBooking = (listing, renter, status) => prisma.rentalBooking.create({ data: { listingId: listing.id, renterId: renter.id, startDate: new Date(Date.now() + day), endDate: new Date(Date.now() + 3 * day), totalPrice: 2040, hostAmount: 2000, platformFee: 40, discountAmount: 0, status } });

async function seed() {
  const attacker = await makeUser({ key: 'attacker', verified: true, balance: 5000 });
  const victim = await makeUser({ key: 'victim', verified: true, balance: 9000 });
  const admin = await makeUser({ key: 'admin', role: 'ADMIN', verified: true });
  const banned = await makeUser({ key: 'banned', verified: true, banned: true });
  const atk = await makeVehicleAndListing(attacker, 'ATK');
  const vic = await makeVehicleAndListing(victim, 'VIC');
  const attackerBooking = await makeBooking(vic.listing, attacker, 'CONFIRMED');
  const victimBooking = await makeBooking(atk.listing, victim, 'PENDING');
  const victimConfirmed = await makeBooking(atk.listing, victim, 'CONFIRMED');
  const trip = await prisma.trip.create({ data: { title: 'Victim private trip', destination: 'Nowhere', startDate: new Date(Date.now() + day), endDate: new Date(Date.now() + 5 * day), maxParticipants: 6, status: 'OPEN', isPublic: false, organizerId: victim.id } });
  await prisma.tripMember.create({ data: { tripId: trip.id, userId: victim.id, status: 'APPROVED' } });
  await prisma.expense.create({ data: { tripId: trip.id, payerId: victim.id, title: 'Secret fuel', amount: 500, category: 'TRANSPORT', date: new Date() } });
  const victimWallet = await prisma.wallet.findUnique({ where: { userId: victim.id } });
  const topupOrderId = `topup_${tag}_victim`;
  await prisma.walletTransaction.create({ data: { walletId: victimWallet.id, type: 'TOPUP', amount: 2500, status: 'PENDING', provider: 'CASHFREE', referenceId: topupOrderId, description: 'Seeded pending top-up' } });

  return {
    users: { attacker, victim, admin, banned },
    tokens: {
      attacker: sign(attacker.id), victim: sign(victim.id), banned: sign(banned.id),
      attackerExpired: sign(attacker.id, { expiresIn: -60 }),
      wrongSecret: jwt.sign({ sub: attacker.id }, 'the-wrong-secret-value', { expiresIn: '15m' }),
      forgedVictimSub: jwt.sign({ sub: victim.id }, 'the-wrong-secret-value', { expiresIn: '15m' }),
    },
    fixtures: { attackerVehicleId: atk.vehicle.id, victimVehicleId: vic.vehicle.id, attackerListingId: atk.listing.id, victimListingId: vic.listing.id, attackerBookingId: attackerBooking.id, victimBookingId: victimBooking.id, victimConfirmedBookingId: victimConfirmed.id, victimTripId: trip.id, victimTopupOrderId: topupOrderId },
  };
}

async function cleanup() {
  if (KEEP || seededUserIds.length === 0) return;
  // Children first, then the users (fixtures are all owned by the seeded users).
  const ids = seededUserIds;
  const vehicles = await prisma.vehicle.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  const vehicleIds = vehicles.map((v) => v.id);
  const listings = await prisma.rentalListing.findMany({ where: { OR: [{ hostId: { in: ids } }, { vehicleId: { in: vehicleIds } }] }, select: { id: true } });
  const listingIds = listings.map((l) => l.id);
  const trips = await prisma.trip.findMany({ where: { organizerId: { in: ids } }, select: { id: true } });
  const tripIds = trips.map((t) => t.id);
  const wallets = await prisma.wallet.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  const walletIds = wallets.map((w) => w.id);
  await prisma.rentalBooking.deleteMany({ where: { OR: [{ renterId: { in: ids } }, { listingId: { in: listingIds } }] } });
  await prisma.expense.deleteMany({ where: { tripId: { in: tripIds } } });
  await prisma.tripMember.deleteMany({ where: { OR: [{ userId: { in: ids } }, { tripId: { in: tripIds } }] } });
  await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
  await prisma.rentalListing.deleteMany({ where: { id: { in: listingIds } } });
  await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
  await prisma.walletTransaction.deleteMany({ where: { walletId: { in: walletIds } } });
  await prisma.verification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.policyAcceptance.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

// ---- the attacks ----------------------------------------------------------
async function run(ctx) {
  const { users, tokens, fixtures } = ctx;
  const atk = tokens.attacker; const vic = tokens.victim;
  let r;

  // A. Authentication & session
  check({ id: 'A1', name: 'Protected route rejects no token', category: 'auth', severity: 'high', pass: (await http('GET', '/wallet')).status === 401 });
  const noneToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: users.victim.id })).toString('base64url')}.`;
  check({ id: 'A2', name: 'JWT alg=none forgery rejected', category: 'auth', severity: 'critical', pass: (await http('GET', '/wallet', { token: noneToken })).status === 401 });
  check({ id: 'A3', name: 'JWT signed with wrong secret rejected', category: 'auth', severity: 'critical', pass: (await http('GET', '/wallet', { token: tokens.wrongSecret })).status === 401 });
  check({ id: 'A4', name: 'Forged token for another user rejected', category: 'auth', severity: 'critical', pass: (await http('GET', '/auth/me', { token: tokens.forgedVictimSub })).status === 401 });
  check({ id: 'A5', name: 'Expired token rejected', category: 'auth', severity: 'high', pass: (await http('GET', '/wallet', { token: tokens.attackerExpired })).status === 401 });
  check({ id: 'A6', name: 'Banned user is blocked', category: 'auth', severity: 'high', pass: (await http('GET', '/auth/me', { token: tokens.banned })).status === 403 });
  await http('POST', '/auth/request-otp', { body: { contact: users.victim.email } });
  let otpSucceeded = false;
  for (let i = 0; i < 7; i += 1) { if ((await http('POST', '/auth/verify-otp', { body: { contact: users.victim.email, otpCode: '000000' } })).status === 200) { otpSucceeded = true; break; } }
  check({ id: 'A7', name: 'OTP brute force never succeeds on wrong codes', category: 'auth', severity: 'critical', pass: !otpSucceeded });

  // B. Broken access control (IDOR / BOLA)
  r = await http('POST', `/rentals/bookings/${fixtures.victimConfirmedBookingId}/pay`, { token: atk, body: { method: 'wallet' } });
  check({ id: 'B1', name: "Cannot pay another user's booking", category: 'access-control', severity: 'critical', pass: [403, 404].includes(r.status), detail: `status ${r.status}` });
  r = await http('PATCH', `/rentals/bookings/${fixtures.victimBookingId}/cancel`, { token: atk });
  check({ id: 'B2', name: "Cannot cancel another user's booking", category: 'access-control', severity: 'high', pass: [403, 404].includes(r.status), detail: `status ${r.status}` });
  r = await http('PATCH', `/rentals/bookings/${fixtures.attackerBookingId}/respond`, { token: atk, body: { status: 'CONFIRMED' } });
  check({ id: 'B3', name: 'Renter cannot self-confirm as the host', category: 'access-control', severity: 'high', pass: [403, 404].includes(r.status), detail: `status ${r.status}` });
  r = await http('PUT', `/users/${users.victim.id}`, { token: atk, body: { name: 'Hacked' } });
  check({ id: 'B4', name: "Cannot edit another user's profile", category: 'access-control', severity: 'high', pass: r.status === 403, detail: `status ${r.status}` });
  r = await http('PUT', `/vehicles/${fixtures.victimVehicleId}`, { token: atk, body: { make: 'Stolen' } });
  check({ id: 'B5', name: "Cannot edit another user's vehicle", category: 'access-control', severity: 'high', pass: [403, 404].includes(r.status), detail: `status ${r.status}` });
  r = await http('PUT', `/trips/${fixtures.victimTripId}`, { token: atk, body: { title: 'Hijacked' } });
  check({ id: 'B6', name: "Cannot edit another user's trip", category: 'access-control', severity: 'high', pass: [403, 404].includes(r.status), detail: `status ${r.status}` });
  r = await http('GET', `/trips/${fixtures.victimTripId}/expenses`, { token: atk });
  check({ id: 'B7', name: 'Non-member cannot read private trip expenses', category: 'access-control', severity: 'high', pass: [403, 404].includes(r.status), detail: `status ${r.status}` });

  // C. Privilege escalation & mass assignment
  await http('PUT', `/users/${users.attacker.id}`, { token: atk, body: { name: 'Atk', role: 'ADMIN', isBanned: false } });
  r = await http('GET', '/auth/me', { token: atk });
  check({ id: 'C1', name: 'Cannot self-promote to ADMIN via profile update', category: 'privilege', severity: 'critical', pass: r.json?.user?.role !== 'ADMIN', detail: `role ${r.json?.user?.role}` });
  const freshVehicle = async () => (await prisma.vehicle.create({ data: { ownerId: users.attacker.id, make: 'Probe', model: 'MA', year: 2023, type: 'CAR', licensePlate: `MA${Date.now()}${Math.floor(Math.random() * 1000)}`, seats: 5, fuelType: 'Petrol', transmission: 'Manual', images: [], isVerified: false } })).id;
  let vId = await freshVehicle();
  await http('PUT', `/vehicles/${vId}`, { token: atk, body: { make: 'Probe', isVerified: true } });
  let after = await prisma.vehicle.findUnique({ where: { id: vId }, select: { isVerified: true } });
  check({ id: 'C2', name: 'Owner cannot self-mark vehicle as verified', category: 'mass-assignment', severity: 'high', pass: after?.isVerified !== true, detail: after?.isVerified === true ? 'isVerified set from request body' : 'ok' });
  vId = await freshVehicle();
  await http('PUT', `/vehicles/${vId}`, { token: atk, body: { make: 'Probe', ownerId: users.victim.id } });
  after = await prisma.vehicle.findUnique({ where: { id: vId }, select: { ownerId: true } });
  check({ id: 'C3', name: 'Client cannot reassign vehicle ownerId', category: 'mass-assignment', severity: 'high', pass: after?.ownerId !== users.victim.id, detail: after?.ownerId === users.victim.id ? 'ownerId overwritten from request body' : 'ok' });
  check({ id: 'C4', name: 'Normal user blocked from admin API', category: 'privilege', severity: 'critical', pass: (await http('GET', '/admin/stats', { token: atk })).status === 403 });

  // D. Injection & XSS
  const sqli = "' OR '1'='1'; DROP TABLE users;--";
  r = await http('GET', `/trips?search=${encodeURIComponent(sqli)}`);
  const stillUp = (await http('GET', '/trips?limit=1')).status === 200;
  check({ id: 'D1', name: 'SQL injection in search is neutralised', category: 'injection', severity: 'critical', pass: r.status === 200 && r.json?.success !== false && stillUp, detail: `status ${r.status}, tableUp ${stillUp}` });
  r = await http('POST', '/auth/request-otp', { body: { contact: { not: '' } } });
  check({ id: 'D2', name: 'Object/operator injection in contact handled cleanly', category: 'input-validation', severity: 'low', pass: r.status >= 400 && r.status < 500, detail: `status ${r.status} (500 = unhandled type)` });
  const xss = '<script>alert(document.cookie)</script>';
  const created = await http('POST', '/trips', { token: atk, body: { title: xss, destination: 'XSS City', startDate: new Date(Date.now() + day).toISOString().slice(0, 10), endDate: new Date(Date.now() + 2 * day).toISOString().slice(0, 10), maxParticipants: 4, isPublic: true } });
  let xssEscaped = true; let shareDetail = 'no trip created';
  if (created.json?.data?.id) {
    const share = await fetch(`${BASE}/share/trips/${created.json.data.id}`, { headers: { 'User-Agent': 'WhatsApp/2.23' }, redirect: 'manual' });
    xssEscaped = !/<script>alert\(document\.cookie\)<\/script>/.test(await share.text());
    shareDetail = `raw script present: ${!xssEscaped}`;
    await prisma.trip.delete({ where: { id: created.json.data.id } }).catch(() => {});
  }
  check({ id: 'D3', name: 'Stored title is HTML-escaped in share preview', category: 'xss', severity: 'high', pass: xssEscaped, detail: shareDetail });

  // E. Payment integrity
  r = await http('POST', `/rentals/bookings/${fixtures.attackerBookingId}/pay`, { token: atk, body: { method: 'wallet', expectedAmount: 1 } });
  check({ id: 'E1', name: 'Cannot pay a booking for the wrong (tiny) amount', category: 'payment', severity: 'critical', pass: !(r.status === 200 && r.json?.success !== false), detail: `status ${r.status}` });
  r = await http('POST', '/wallet/topup/verify', { token: atk, body: { orderId: fixtures.victimTopupOrderId } });
  check({ id: 'E2', name: "Cannot verify another user's top-up order", category: 'payment', severity: 'high', pass: [403, 404].includes(r.status), detail: `status ${r.status}` });
  const before = (await http('GET', '/wallet', { token: vic })).json?.data?.balance;
  await fetch(`${API}/wallet/webhook/cashfree`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { order: { order_id: fixtures.victimTopupOrderId, order_status: 'PAID' } } }) }).catch(() => {});
  const afterBal = (await http('GET', '/wallet', { token: vic })).json?.data?.balance;
  check({ id: 'E3', name: 'Forged payment webhook does not credit wallet', category: 'payment', severity: 'critical', pass: afterBal === before, detail: `before ${before} after ${afterBal}` });
  check({ id: 'E4', name: 'Negative top-up amount rejected', category: 'payment', severity: 'high', pass: (await http('POST', '/wallet/topup', { token: atk, body: { amount: -5000 } })).status >= 400 });
  r = await http('POST', '/wallet/withdraw', { token: atk, body: { amount: 1000000, mode: 'upi', upiId: 'x@upi', accountName: 'X' } });
  check({ id: 'E5', name: 'Cannot withdraw more than wallet balance', category: 'payment', severity: 'critical', pass: !(r.status === 200 && r.json?.success !== false), detail: `status ${r.status}` });

  // F. Transport, headers, rate limiting
  r = await http('GET', '/trips?limit=1');
  check({ id: 'F1', name: 'Security headers present (helmet)', category: 'hardening', severity: 'medium', pass: !!(r.headers.get('x-content-type-options') || r.headers.get('x-frame-options') || r.headers.get('content-security-policy')) });
  r = await http('GET', '/trips?limit=1', { origin: 'https://evil.example.com' });
  check({ id: 'F2', name: 'CORS does not reflect an unknown origin', category: 'hardening', severity: 'medium', pass: r.headers.get('access-control-allow-origin') !== 'https://evil.example.com' });
  check({ id: 'F3', name: 'Private RC uploads are not served', category: 'hardening', severity: 'high', pass: (await fetch(`${BASE}/uploads/rc/anything.jpg`)).status === 404 });
  const huge = await http('POST', '/auth/request-otp', { body: { contact: 'x@test.local', blob: 'a'.repeat(11 * 1024 * 1024) } });
  check({ id: 'F4', name: 'Oversized request body rejected', category: 'hardening', severity: 'low', pass: [400, 413].includes(huge.status), detail: `status ${huge.status}` });
  let got429 = false;
  for (let i = 0; i < 40; i += 1) { if ((await http('POST', '/auth/request-otp', { body: { contact: `flood${i}.${tag}@test.local` } })).status === 429) { got429 = true; break; } }
  check({ id: 'F5', name: 'Auth endpoint is rate limited', category: 'hardening', severity: 'medium', pass: got429 });
}

(async () => {
  let failedHard = 0;
  try {
    const ctx = await seed();
    await run(ctx);
  } catch (e) {
    console.error('\nSuite error:', e);
    failedHard = 1;
  } finally {
    await cleanup().catch((e) => console.error('cleanup failed:', e.message));
    const fails = results.filter((t) => !t.pass);
    const bySev = (s) => fails.filter((t) => t.severity === s).length;
    console.log(`\n${results.length} tests, ${results.length - fails.length} passed, ${fails.length} failed`);
    console.log(`Failing by severity: critical ${bySev('critical')}, high ${bySev('high')}, medium ${bySev('medium')}, low ${bySev('low')}`);
    await prisma.$disconnect();
    const hardFails = fails.filter((t) => t.severity === 'critical' || t.severity === 'high').length;
    process.exit(failedHard || hardFails ? 1 : 0);
  }
})();
