/** Isolated integration check: always starts its own local PostgreSQL; never uses a supplied database URL. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = path.join(root, '.tmp-host-pg');
const { default: EmbeddedPostgres } = await import(pathToFileURL(path.join(temporary, 'node_modules/embedded-postgres/dist/index.js')));
const socket = net.createServer();
await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const directory = path.resolve(temporary, `db-${randomUUID()}`);
assert(directory.startsWith(path.resolve(temporary) + path.sep));
const password = randomBytes(18).toString('hex');
const database = new EmbeddedPostgres({ databaseDir: directory, user: 'postgres', password, port, persistent: true, initdbFlags: ['--encoding=UTF8'], onLog: () => {}, onError: () => {} });
let prisma;
let assertions = 0;
const check = (fn) => { fn(); assertions += 1; };
try {
    await database.initialise();
    await database.start();
    await database.createDatabase('host_categories_test');
    const url = `postgresql://postgres:${password}@127.0.0.1:${port}/host_categories_test?connection_limit=6`;
    const parsed = new URL(url);
    assert.equal(parsed.hostname, '127.0.0.1');
    assert.equal(parsed.pathname, '/host_categories_test');
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    process.env.NODE_ENV = 'test';
    // No email or provider calls are needed. Test users have no email or push devices.
    for (const key of Object.keys(process.env)) if (/^(SMTP_|ZEPTOMAIL_)/.test(key)) delete process.env[key];
    // Derive the schema immediately before this migration without depending on a Git checkout depth/ref.
    const currentSchema = await fs.readFile(path.join(root, 'backend/prisma/schema.prisma'), 'utf8');
    const baseline = currentSchema
        .replace(/^model (?:AircraftHosting|CharterInquiry) \{[\s\S]*?^\}/gm, '')
        .replace(/^[ \t]+aircraftHosting[ \t]+AircraftHosting\?[ \t]*\r?\n/gm, '')
        .replace(/^[ \t]+charterInquiries[ \t]+CharterInquiry\[\][ \t]*\r?\n/gm, '');
    const baselinePath = path.join(temporary, 'baseline.prisma');
    await fs.writeFile(baselinePath, baseline);
    const prismaCli = path.join(root, 'node_modules/prisma/build/index.js');
    const run = (args) => execFileSync(process.execPath, [prismaCli, ...args], { cwd: root, env: process.env, stdio: 'pipe' });
    run(['db', 'push', '--schema', baselinePath, '--skip-generate']);
    run(['db', 'execute', '--schema', 'backend/prisma/schema.prisma', '--file', 'backend/prisma/migrations/20261021180000_hosting_categories_charters/migration.sql']);
    ({ prisma } = await import('../src/utils/prisma.js'));
    const { registerVehicle } = await import('../src/controllers/vehicle.controller.js');
    const { updateHostListing } = await import('../src/controllers/hostListing.controller.js');
    const { bookRental } = await import('../src/controllers/rental.controller.js');
    const { submitAircraft, reviewAircraft, publishAircraft, listPublicAircraft, createCharterInquiry, respondToCharterInquiry } = await import('../src/controllers/aviation.controller.js');
    const { AIRCRAFT_DOCUMENTS } = await import('../src/utils/aviation.js');
    const response = () => ({ value: null, status() { return this; }, json(value) { this.value = value; return this; } });
    const host = await prisma.user.create({ data: { name: 'Test host' } });
    const guest = await prisma.user.create({ data: { name: 'Test guest' } });
    const admin = await prisma.user.create({ data: { name: 'Test admin', role: 'ADMIN' } });
    for (const user of [host, guest]) {
        await prisma.verification.createMany({ data: ['DL', 'AADHAAR'].map((documentType) => ({ userId: user.id, documentType, status: 'VERIFIED' })) });
        await prisma.policyAcceptance.createMany({ data: ['LISTING_TERMS', 'RENTAL_TERMS'].map((policyType) => ({ userId: user.id, policyType, policyVersion: '1.0' })) });
    }
    const vehicles = {};
    for (const type of ['CAR', 'BIKE', 'SCOOTER', 'HELICOPTER']) {
        const res = response();
        await registerVehicle({ user: host, body: { type, make: 'Test', model: type, year: 2024, licensePlate: `TEST-${type}`, seats: ['BIKE', 'SCOOTER'].includes(type) ? 2 : 4, fuelType: 'Petrol', transmission: 'Manual', images: [], ...(type === 'HELICOPTER' ? { aircraft: { operatorName: 'Test operator', operatorPermitNumber: 'Test reference', baseAirport: 'Test base', pricePerHour: 50000 } } : {}) } }, res);
        vehicles[type] = res.value.data;
        check(() => assert.equal(res.value.data.type, type));
    }
    const aircraft = await prisma.aircraftHosting.findUnique({ where: { vehicleId: vehicles.HELICOPTER.id } });
    check(() => assert.equal(aircraft.status, 'DRAFT'));
    check(() => assert.equal(aircraft.isPublished, false));
    const documents = Object.fromEntries(Object.keys(AIRCRAFT_DOCUMENTS).map((key) => [key, { url: '/private-test-only.jpg', expiresAt: '2099-12-31' }]));
    await prisma.aircraftHosting.update({ where: { id: aircraft.id }, data: { documents } });
    const hostReq = (body = {}) => ({ user: host, params: { vehicleId: vehicles.HELICOPTER.id }, body });
    await submitAircraft(hostReq(), response());
    await reviewAircraft({ user: admin, params: hostReq().params, body: { status: 'APPROVED', note: 'Test fixture operator evidence reviewed.' } }, response());
    await publishAircraft(hostReq({ isPublished: true }), response());
    const directoryResponse = response(); await listPublicAircraft({}, directoryResponse);
    check(() => assert.equal(directoryResponse.value.data.length, 1));
    check(() => assert.equal(directoryResponse.value.data[0].pricingUnit, 'HOUR'));
    check(() => assert(!JSON.stringify(directoryResponse.value.data).includes('private-test-only')));
    const inquiryResponse = response();
    await createCharterInquiry({ user: guest, params: { id: aircraft.id }, body: { requestedDate: '2099-01-01', origin: 'Test origin', destination: 'Test destination', passengers: 2 } }, inquiryResponse);
    await respondToCharterInquiry({ user: host, params: { id: inquiryResponse.value.data.id }, body: { status: 'QUOTED', quotedAmount: 70000, quoteNote: 'Test quote conditions and next steps.' } }, response());
    const inquiry = await prisma.charterInquiry.findUnique({ where: { id: inquiryResponse.value.data.id } });
    check(() => assert.equal(inquiry.status, 'QUOTED'));
    check(() => assert.equal(inquiry.quotedAmount, 70000));
    const walletMovements = await prisma.walletTransaction.count();
    check(() => assert.equal(walletMovements, 0));
    await prisma.aircraftHosting.update({ where: { id: aircraft.id }, data: { documents: { ...documents, insurance: { url: '/private-test-only.jpg', expiresAt: '2000-01-01' } } } });
    const expiredResponse = response(); await listPublicAircraft({}, expiredResponse);
    check(() => assert.equal(expiredResponse.value.data.length, 0));
    // Exercise the exact PostgreSQL lock used by listing edits and booking creation.
    await prisma.vehicle.update({ where: { id: vehicles.CAR.id }, data: { isVerified: true } });
    const listing = await prisma.rentalListing.create({ data: { hostId: host.id, vehicleId: vehicles.CAR.id, pricePerDay: 1000, location: 'Test city', availableFrom: new Date('2099-01-01'), availableTo: new Date('2099-12-31') } });
    let pendingBooking;
    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listing.id}))`;
        await tx.rentalListing.update({ where: { id: listing.id }, data: { pricePerDay: 2000 } });
        pendingBooking = bookRental({ user: guest, body: { listingId: listing.id, startDate: '2099-02-01', endDate: '2099-02-03' }, app: { get: () => null } }, response()).then(() => ({ success: true }), (error) => ({ error }));
        let waiting = false;
        for (let index = 0; index < 100; index += 1) {
            const rows = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`;
            if (rows[0].count > 0) { waiting = true; break; }
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        check(() => assert(waiting, 'The guest booking should wait on the listing lock.'));
    });
    const outcome = await pendingBooking;
    check(() => assert.equal(outcome.error?.statusCode, 409));
    const insertedBookings = await prisma.rentalBooking.count();
    check(() => assert.equal(insertedBookings, 0));
    const reservation = await prisma.rentalBooking.create({ data: { listingId: listing.id, renterId: guest.id, startDate: new Date('2099-03-01'), endDate: new Date('2099-03-05'), totalPrice: 8160, hostAmount: 8000, platformFee: 160, status: 'PAID' } });
    await assert.rejects(() => updateHostListing({ user: host, params: { id: listing.id }, body: { availableTo: '2099-03-02' } }, response()), (error) => error.statusCode === 409); assertions += 1;
    const intact = await prisma.rentalBooking.findUnique({ where: { id: reservation.id } });
    check(() => assert.equal(intact.totalPrice, 8160));
    console.log(JSON.stringify({ passed: true, assertions, checks: ['actual migration SQL', 'four category persistence', 'operator review/publication', 'public document redaction', 'charter quotes without wallet movement', 'expired-document visibility', 'PostgreSQL advisory-lock race', 'existing paid reservation protection'] }, null, 2));
} finally {
    if (prisma) await prisma.$disconnect();
    await database.stop().catch(() => {});
}
