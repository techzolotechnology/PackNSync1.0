// Local-only UI fixtures. No OTP, vehicle, booking or payout request reaches production.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const root = path.resolve(__dirname, '../dist/web');
const output = path.resolve(__dirname, '../../..', '.tmp-host-ui');
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, `.${decodeURIComponent(req.url.split('?')[0])}`);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.HOST_BROWSER_CHANNEL ? { channel: process.env.HOST_BROWSER_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  const mutations = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const vehicle = { id: 'fixture-car', make: 'Hyundai', model: 'i20', year: 2024, licensePlate: 'TEST01CAR', type: 'CAR', seats: 5, fuelType: 'Petrol', transmission: 'Manual', images: [], isVerified: true };
  const aircraft = { ...vehicle, id: 'fixture-heli', type: 'HELICOPTER', make: 'Test aircraft', model: 'Helicopter', licensePlate: 'VT-XXX', seats: 4, aircraftHosting: { id: 'fixture-aircraft', status: 'APPROVED', isPublished: false, operatorName: 'Test operator', operatorPermitNumber: 'Test reference', baseAirport: 'Test helipad', pricePerHour: 50000, currency: 'INR', description: 'UI test aircraft', documents: Object.fromEntries(['registration', 'operatorPermit', 'airworthiness', 'insurance'].map((key) => [key, { url: '/private-file.jpg', expiresAt: '2099-12-31' }])) } };
  const vehicles = [vehicle, { ...vehicle, id: 'fixture-bike', type: 'BIKE', make: 'Royal Enfield', model: 'Hunter', seats: 2 }, { ...vehicle, id: 'fixture-scooter', type: 'SCOOTER', make: 'Honda', model: 'Activa', seats: 2, transmission: 'Automatic' }, aircraft];
  const listing = { id: 'fixture-listing', vehicleId: vehicle.id, vehicle, hostId: 'fixture-host', pricePerDay: 2000, currency: 'INR', location: 'Bengaluru', availableFrom: '2026-01-01T00:00:00.000Z', availableTo: '2030-12-31T00:00:00.000Z', isActive: true };
  const guest = { id: 'fixture-guest', name: 'Test guest' };
  const bookings = [{ id: 'fixture-request', listing, renter: guest, status: 'PENDING', hostAmount: 4000, totalPrice: 4080, startDate: '2030-02-01', endDate: '2030-02-03' }, { id: 'fixture-paid', listing, renter: guest, status: 'PAID', hostAmount: 4000, totalPrice: 4080, startDate: '2030-02-10', endDate: '2030-02-12' }];
  const user = { id: 'fixture-host', email: 'host@example.test', name: 'Test Host', city: 'Bengaluru' };
  const inquiry = { id: 'fixture-inquiry', status: 'NEW', requestedDate: '2099-01-01', origin: 'Test departure', destination: 'Test destination', passengers: 2, requester: { name: 'Test guest' }, aircraft: { ...aircraft.aircraftHosting, vehicle: aircraft } };
  await page.route('https://api.pickandsync.com/api/**', async (route) => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname.replace('/api', '');
    const body = req.postDataJSON();
    if (req.method() !== 'GET') mutations.push({ endpoint, body });
    let data;
    if (endpoint === '/auth/request-otp') return route.fulfill({ json: { success: true } });
    if (endpoint === '/auth/verify-otp') return route.fulfill({ json: { success: true, user, accessToken: 'fixture-access', refreshToken: 'fixture-refresh' } });
    if (endpoint === '/auth/logout') return route.fulfill({ json: { success: true } });
    if (endpoint === '/vehicles/my') data = vehicles;
    else if (endpoint === '/aviation/inquiries/host') data = [inquiry];
    else if (endpoint === '/aviation/inquiries/fixture-inquiry/respond') { Object.assign(inquiry, body); data = inquiry; }
    else if (endpoint === '/aviation/aircraft/fixture-heli/publish') { aircraft.aircraftHosting.isPublished = body.isPublished; data = aircraft.aircraftHosting; }
    else if (endpoint === '/rentals/listings/host') data = [listing];
    else if (endpoint === '/rentals/bookings/host') {
      data = bookings;
    } else if (endpoint === '/verifications/status') data = { isFullyVerified: true, latestByType: { DL: { status: 'VERIFIED' }, AADHAAR: { status: 'VERIFIED' } } };
    else if (endpoint === '/verifications/policies/status') data = { status: { LISTING_TERMS: true } };
    else if (endpoint === '/rentals/earnings/my') data = { upcoming: 4000, onHold: 0, released: 2000, earnings: [{ id: 'fixture-earning', status: 'PENDING', amount: 4000, releaseAt: '2030-02-13', booking: bookings[1] }] };
    else if (endpoint === '/wallet') data = { balance: 7000, currency: 'INR', promoBalance: 100, payoutsReady: true, mockMode: true };
    else if (endpoint === '/wallet/transactions') data = [];
    else if (endpoint === '/notifications') data = [{ id: 'fixture-notice', title: 'Test booking request', body: 'This is a UI test fixture.', isRead: false, createdAt: '2026-10-21', data: { bookingId: 'fixture-request' } }];
    else if (endpoint.endsWith('/respond')) { bookings[0].status = body.status; data = bookings[0]; }
    else if (endpoint === '/rentals/listings/fixture-listing') { Object.assign(listing, body); data = listing; }
    else if (endpoint === '/users/fixture-host') { Object.assign(user, body); data = user; }
    else if (endpoint.includes('/notifications/')) data = {};
    else throw new Error(`Unimplemented fixture endpoint ${endpoint}`);
    await route.fulfill({ json: { success: true, data } });
  });
  // Fail closed: the test is limited to its local static app and intercepted API.
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:') || url.startsWith('https://api.pickandsync.com/api/')) return route.fallback();
    return route.abort();
  });
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByLabel('Email address', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '01-sign-in.png'), fullPage: true });
    await page.getByLabel('Email address', { exact: true }).fill('host@example.test');
    await page.getByRole('button', { name: /Send sign-in code/ }).click();
    await page.getByLabel('Six-digit email code').fill('123456');
    await page.getByRole('button', { name: /Open my host dashboard/ }).click();
    await page.getByText('Ready for the next journey.', { exact: true }).waitFor();
    await page.getByText('Good journeys start', { exact: false }).waitFor();
    await page.screenshot({ path: path.join(output, '02-dashboard.png'), fullPage: true });
    await page.getByRole('tab', { name: 'Fleet', exact: true }).click();
    await page.getByText('Hyundai i20', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '03-fleet.png'), fullPage: true });
    await page.getByRole('button', { name: 'Add vehicle', exact: true }).click();
    await page.getByRole('button', { name: 'Host a bike', exact: true }).click();
    assert.equal(await page.getByLabel('Seats', { exact: true }).inputValue(), '2');
    await page.getByRole('button', { name: 'Host a scooter', exact: true }).click();
    assert.equal(await page.getByLabel('Seats', { exact: true }).inputValue(), '2');
    await page.getByRole('button', { name: 'Host a helicopter', exact: true }).click();
    await page.getByLabel('Operator company name', { exact: true }).waitFor();
    await page.getByLabel('Indicative hourly rate (INR)', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '07-hosting-categories.png'), fullPage: true });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Helicopters (1)', exact: true }).click();
    assert.equal(await page.getByText('Hyundai i20', { exact: true }).count(), 0);
    await page.getByRole('button', { name: /Charter setup/ }).click();
    await page.getByRole('button', { name: 'Publish for charter enquiries', exact: true }).click();
    await page.getByText('Charter listing published for enquiries.', { exact: true }).waitFor();
    assert.equal(aircraft.aircraftHosting.isPublished, true);
    await page.screenshot({ path: path.join(output, '08-helicopter-setup.png'), fullPage: true });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Cars (1)', exact: true }).click();
    await page.getByRole('button', { name: 'Manage Hyundai i20 listing' }).click();
    await page.getByLabel('Your daily price (INR)').fill('2400');
    await page.getByRole('button', { name: /Save listing/ }).click();
    await page.getByText('Listing saved.', { exact: false }).waitFor();
    assert.equal(listing.pricePerDay, 2400);
    assert.equal(bookings[0].hostAmount, 4000);
    await page.getByRole('tab', { name: 'Bookings', exact: true }).click();
    await page.getByRole('button', { name: /Accept$/, exact: false }).click();
    await page.getByRole('button', { name: 'Accept request', exact: true }).click();
    await page.getByText('Request accepted.', { exact: false }).waitFor();
    assert.equal(bookings[0].status, 'CONFIRMED');
    await page.getByRole('button', { name: 'Helicopter enquiries', exact: true }).click();
    await page.getByRole('button', { name: 'Quote or decline', exact: true }).click();
    await page.getByLabel('Full charter quote (INR)').fill('70000');
    await page.getByLabel('Quote conditions / explanation').fill('Test quote. Contact the operator to confirm availability.');
    await page.getByRole('button', { name: 'Send quote', exact: true }).click();
    await page.getByText('Quote sent.', { exact: false }).waitFor();
    assert.equal(inquiry.status, 'QUOTED');
    assert.equal(inquiry.quotedAmount, 70000);
    assert.equal(mutations.some((m) => m.endpoint === '/wallet/withdraw'), false);
    await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
    await page.getByText('Your schedule', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '04-calendar.png'), fullPage: true });
    await page.getByRole('tab', { name: 'Earnings', exact: true }).click();
    await page.getByText('Cash in your wallet', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '05-earnings.png'), fullPage: true });
    await page.getByRole('button', { name: /Withdraw funds/ }).click();
    await page.getByLabel('Withdrawal amount (INR)').fill('500');
    await page.getByLabel('UPI ID', { exact: true }).fill('fixture@bank');
    await page.getByRole('button', { name: 'Review withdrawal', exact: true }).click();
    await page.getByText('Confirm withdrawal', { exact: true }).waitFor();
    assert.equal(mutations.some((m) => m.endpoint === '/wallet/withdraw'), false);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Open host account' }).click();
    await page.getByLabel('Your name', { exact: true }).fill('Updated Test Host');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByText('Profile updated.', { exact: true }).waitFor();
    assert.equal(user.name, 'Updated Test Host');
    // Exercise a second viewport without regenerating or replacing the application.
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.getByRole('tab', { name: 'Home', exact: true }).click();
    await page.getByText('Ready for the next journey.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, '06-tablet-dashboard.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal layout overflow');
    await page.getByRole('button', { name: 'Open host account' }).click();
    await page.getByRole('button', { name: /Sign out$/, exact: false }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).last().click();
    await page.getByLabel('Email address', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, assertions: ['OTP sign-in', 'four category forms', 'category fleet filtering', 'helicopter publication', 'charter quote without wallet payment', 'real-screen rendering', 'listing edit', 'booking acceptance', 'calendar', 'withdrawal review without payment', 'profile save', 'tablet layout', 'sign-out'], screenshots: output }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
