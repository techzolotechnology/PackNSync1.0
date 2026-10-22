import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDamageInspectionService,
  diffDamages,
  buildEstimate,
  DEFAULT_RATE_CARD,
  createMemoryStore,
} from '../src/index.js';
import { mockInspectionProvider } from '../src/providers/inspection/mock.js';
import { mockClaimsProvider } from '../src/providers/claims/mock.js';

test('diffDamages filters pre-existing identical damage and identifies new damages', () => {
  const checkinDamages = [
    { part: 'front-bumper', type: 'scratch', severity: 'minor', confidence: 0.95 },
  ];
  const checkoutDamages = [
    { part: 'front-bumper', type: 'scratch', severity: 'minor', confidence: 0.95 }, // identical
    { part: 'left-door', type: 'dent', severity: 'moderate', confidence: 0.9 }, // new
    { part: 'bonnet', type: 'scratch', severity: 'minor', confidence: 0.4 }, // too low confidence
  ];

  const diff = diffDamages(checkinDamages, checkoutDamages);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].part, 'left-door');
  assert.equal(diff[0].type, 'dent');
  assert.equal(diff[0].severity, 'moderate');
});

test('diffDamages detects aggravated damage when severity increases', () => {
  const checkinDamages = [
    { part: 'rear-bumper', type: 'scratch', severity: 'minor', confidence: 0.9 },
  ];
  const checkoutDamages = [
    { part: 'rear-bumper', type: 'scratch', severity: 'severe', confidence: 0.92 },
  ];

  const diff = diffDamages(checkinDamages, checkoutDamages);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].part, 'rear-bumper');
  assert.equal(diff[0].severity, 'severe');
});

test('buildEstimate calculates itemised parts, labour, multipliers and 18% GST', () => {
  const damages = [
    { part: 'front-bumper', type: 'scratch', severity: 'minor' }, // 1500 * 1.2 = 1800
    { part: 'windshield', type: 'crack', severity: 'minor' }, // 3000 * 1.8 = 5400
  ];
  const estimate = buildEstimate(damages);

  assert.equal(estimate.currency, 'INR');
  assert.equal(estimate.items.length, 2);
  assert.equal(estimate.items[0].amount, 1800);
  assert.equal(estimate.items[1].amount, 5400);

  const expectedPartsAndLabour = 1800 + 5400; // 7200
  const expectedTax = Math.round(7200 * 0.18); // 1296
  assert.equal(estimate.partsAndLabour, expectedPartsAndLabour);
  assert.equal(estimate.tax, expectedTax);
  assert.equal(estimate.total, expectedPartsAndLabour + expectedTax);
});

test('mockInspectionProvider reads damage tags from image angles and URLs', async () => {
  const result = await mockInspectionProvider.inspect({
    vehicle: { vehicleId: 'veh_1', vin: 'VIN123' },
    stage: 'checkin',
    images: [
      { url: 'https://images.example.com/front.jpg', angle: 'front [scratch:front-bumper:minor]' },
      { url: 'https://images.example.com/side.jpg', angle: 'left-side [dent:left-door:moderate]' },
      { url: 'https://images.example.com/clean.jpg', angle: 'rear' },
    ],
  });

  assert.equal(result.damages.length, 2);
  assert.equal(result.damages[0].part, 'front-bumper');
  assert.equal(result.damages[0].type, 'scratch');
  assert.equal(result.damages[1].part, 'left-door');
  assert.equal(result.damages[1].type, 'dent');
});

test('mockClaimsProvider auto-approves compliant claim and flags large claims for review', async () => {
  const vehicle = { vehicleId: 'veh_1' };

  // Under limit
  const smallClaim = await mockClaimsProvider.fileClaim({
    bookingId: 'book_1',
    vehicle,
    newDamages: [{ part: 'door', type: 'scratch', severity: 'minor', confidence: 0.9 }],
    estimate: { total: 3500, currency: 'INR', items: [] },
    evidence: {},
  });
  assert.equal(smallClaim.status, 'auto_approved');
  assert.equal(smallClaim.payout, 3500);

  // Over limit (e.g., > 25000)
  const largeClaim = await mockClaimsProvider.fileClaim({
    bookingId: 'book_2',
    vehicle,
    newDamages: [{ part: 'bonnet', type: 'broken', severity: 'severe', confidence: 0.95 }],
    estimate: { total: 45000, currency: 'INR', items: [] },
    evidence: {},
  });
  assert.equal(largeClaim.status, 'needs_review');

  // No damages
  const emptyClaim = await mockClaimsProvider.fileClaim({
    bookingId: 'book_3',
    vehicle,
    newDamages: [],
    estimate: { total: 0, currency: 'INR', items: [] },
    evidence: {},
  });
  assert.equal(emptyClaim.status, 'rejected');
});

test('createDamageInspectionService runs end-to-end clean inspection lifecycle', async () => {
  const service = createDamageInspectionService({
    store: createMemoryStore(),
    inspectionProvider: mockInspectionProvider,
    claimsProvider: mockClaimsProvider,
  });

  const vehicle = { vehicleId: 'veh_clean', vin: 'VIN_CLEAN', plate: 'KA01AB1234' };
  const bookingId = 'book_clean_101';

  // 1. Check-in with clean vehicle photos
  const checkin = await service.recordCheckin({
    bookingId,
    vehicle,
    images: [
      { url: 'https://cdn.pickandsync.com/front.jpg', angle: 'front' },
      { url: 'https://cdn.pickandsync.com/rear.jpg', angle: 'rear' },
    ],
  });
  assert.equal(checkin.damages.length, 0);

  // 2. Check-out with clean vehicle photos
  const checkoutReport = await service.recordCheckout({
    bookingId,
    vehicle,
    images: [
      { url: 'https://cdn.pickandsync.com/front_out.jpg', angle: 'front' },
      { url: 'https://cdn.pickandsync.com/rear_out.jpg', angle: 'rear' },
    ],
  });

  assert.equal(checkoutReport.newDamages.length, 0);
  assert.equal(checkoutReport.estimate.total, 0);
  assert.equal(checkoutReport.claim, null); // no claim created

  // 3. Complete report
  const report = await service.getReport(bookingId);
  assert.equal(report.summary.status, 'passed_clean');
  assert.equal(report.summary.damageCount, 0);
  assert.equal(report.summary.claimStatus, 'no_claim_needed');
});

test('createDamageInspectionService runs end-to-end new damage inspection with auto-claim', async () => {
  const service = createDamageInspectionService({
    store: createMemoryStore(),
    inspectionProvider: mockInspectionProvider,
    claimsProvider: mockClaimsProvider,
  });

  const vehicle = { vehicleId: 'veh_damage', vin: 'VIN_DAMAGE', plate: 'MH02XY9999' };
  const bookingId = 'book_damage_202';

  // 1. Check-in with pre-existing minor chip on rear bumper
  await service.recordCheckin({
    bookingId,
    vehicle,
    images: [
      { url: 'https://cdn.pickandsync.com/rear.jpg', angle: 'rear [chip:rear-bumper:minor]' },
      { url: 'https://cdn.pickandsync.com/left.jpg', angle: 'left-side' },
    ],
  });

  // 2. Check-out retains prior chip BUT has new left-door dent
  const checkout = await service.recordCheckout({
    bookingId,
    vehicle,
    images: [
      { url: 'https://cdn.pickandsync.com/rear_out.jpg', angle: 'rear [chip:rear-bumper:minor]' },
      { url: 'https://cdn.pickandsync.com/left_out.jpg', angle: 'left-side [dent:left-door:moderate]' },
    ],
    policyRef: 'POL_INS_4412',
    autoClaim: true,
  });

  // Prior chip is NOT counted as new damage!
  assert.equal(checkout.newDamages.length, 1);
  assert.equal(checkout.newDamages[0].part, 'left-door');
  assert.equal(checkout.newDamages[0].type, 'dent');

  assert.ok(checkout.estimate.total > 0);
  assert.ok(checkout.claim);
  assert.equal(checkout.claim.status, 'auto_approved');

  // Verify report summary
  const report = await service.getReport(bookingId);
  assert.equal(report.summary.status, 'damage_detected');
  assert.equal(report.summary.damageCount, 1);
  assert.equal(report.summary.claimStatus, 'auto_approved');
  assert.equal(report.claim.claimId, checkout.claim.claimId);
});
