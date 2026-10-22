import { diffDamages } from './compare.js';
import { buildEstimate, DEFAULT_RATE_CARD } from './estimate.js';
import { createMemoryStore } from './store.js';
import { getInspectionProvider } from './providers/inspection/index.js';
import { getClaimsProvider } from './providers/claims/index.js';

/**
 * Creates an instance of the Damage Inspection Service.
 * Allows dependency injection of store, providers, and estimation options.
 *
 * @param {Object} [options]
 * @param {import('./store.js').InspectionStore} [options.store]
 * @param {import('./types.js').InspectionProvider} [options.inspectionProvider]
 * @param {import('./types.js').ClaimsProvider} [options.claimsProvider]
 * @param {Object} [options.rateCard]
 * @param {number} [options.claimAutoApproveLimit]
 * @param {number} [options.minConfidence]
 */
export function createDamageInspectionService(options = {}) {
  const store = options.store || createMemoryStore();
  const getInspector = () => options.inspectionProvider || getInspectionProvider();
  const getClaimer = () => options.claimsProvider || getClaimsProvider();
  const rateCard = options.rateCard || DEFAULT_RATE_CARD;
  const minConfidence = options.minConfidence ?? 0.6;

  /**
   * Record pre-rental check-in inspection.
   *
   * @param {Object} params
   * @param {string} params.bookingId
   * @param {import('./types.js').VehicleRef} params.vehicle
   * @param {import('./types.js').InspectionImage[]} params.images
   * @returns {Promise<import('./types.js').InspectionResult>}
   */
  async function recordCheckin({ bookingId, vehicle, images }) {
    if (!bookingId) throw new Error('bookingId is required for check-in inspection');
    if (!vehicle || !vehicle.vehicleId) throw new Error('vehicle is required for check-in inspection');
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('At least one vehicle image is required for inspection');
    }

    const inspector = getInspector();
    if (await store.getInspection(bookingId, 'checkin')) {
      const error = new Error('Pickup evidence is already recorded and cannot be overwritten.');
      error.statusCode = 409; throw error;
    }
    const result = await inspector.inspect({
      bookingId,
      vehicle,
      stage: 'checkin',
      images,
    });

    await store.saveInspection(bookingId, 'checkin', result);
    return result;
  }

  /**
   * Record post-rental check-out inspection, compare with check-in, calculate
   * repair estimate for new damages, and optionally auto-file insurance claim.
   *
   * @param {Object} params
   * @param {string} params.bookingId
   * @param {import('./types.js').VehicleRef} params.vehicle
   * @param {import('./types.js').InspectionImage[]} params.images
   * @param {string} [params.policyRef]
   * @param {boolean} [params.autoClaim=true]
   * @returns {Promise<{
   *   checkin: import('./types.js').InspectionResult|null,
   *   checkout: import('./types.js').InspectionResult,
   *   newDamages: import('./types.js').DamageFinding[],
   *   estimate: import('./types.js').RepairEstimate,
   *   claim: import('./types.js').ClaimResult|null
   * }>}
   */
  async function recordCheckout({ bookingId, vehicle, images, policyRef, autoClaim = false }) {
    if (!bookingId) throw new Error('bookingId is required for check-out inspection');
    if (!vehicle || !vehicle.vehicleId) throw new Error('vehicle is required for check-out inspection');
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('At least one vehicle image is required for inspection');
    }

    const inspector = getInspector();
    const baseline = await store.getInspection(bookingId, 'checkin');
    if (!baseline || baseline.vehicle.vehicleId !== vehicle.vehicleId) {
      const error = new Error('Matching pickup evidence is required before return.');
      error.statusCode = 409; throw error;
    }
    if (await store.getInspection(bookingId, 'checkout')) {
      const error = new Error('Return evidence is already recorded.');
      error.statusCode = 409; throw error;
    }
    const checkoutResult = await inspector.inspect({
      bookingId,
      vehicle,
      stage: 'checkout',
      images,
    });

    const checkinRecord = await store.getInspection(bookingId, 'checkin');
    const priorDamages = checkinRecord?.damages || [];

    // Calculate delta: only damage that appeared or worsened during rental
    const newDamages = diffDamages(priorDamages, checkoutResult.damages || [], { minConfidence });
    const estimate = checkoutResult.provider === 'pickandsync-local'
      ? { currency: 'INR', items: [], partsAndLabour: 0, tax: 0, total: 0, status: 'quote_required', binding: false }
      : buildEstimate(newDamages, { rateCard });

    await store.saveInspection(bookingId, 'checkout', {
      ...checkoutResult,
      newDamages,
      estimate,
    });

    let claimResult = null;
    if (checkoutResult.provider !== 'pickandsync-local' && autoClaim && newDamages.length > 0 && estimate.total > 0) {
      const claimer = getClaimer();
      claimResult = await claimer.fileClaim({
        bookingId,
        vehicle,
        policyRef,
        incidentDate: checkoutResult.completedAt || new Date().toISOString(),
        newDamages,
        estimate,
        evidence: {
          checkinReportUrl: checkinRecord?.reportUrl,
          checkoutReportUrl: checkoutResult.reportUrl,
          images,
        },
      });
      await store.saveClaim(bookingId, claimResult);
    }

    return {
      checkin: checkinRecord || null,
      checkout: checkoutResult,
      newDamages,
      estimate,
      claim: claimResult,
    };
  }

  /**
   * Retrieve inspection by stage.
   *
   * @param {string} bookingId
   * @param {'checkin'|'checkout'} stage
   */
  async function getInspection(bookingId, stage) {
    return store.getInspection(bookingId, stage);
  }

  /**
   * Retrieve or file an insurance claim for a completed booking.
   *
   * @param {Object} params
   * @param {string} params.bookingId
   * @param {string} [params.policyRef]
   */
  async function fileClaim({ bookingId, policyRef }) {
    const checkout = await store.getInspection(bookingId, 'checkout');
    if (!checkout) {
      throw new Error(`Cannot file claim: no checkout inspection found for booking ${bookingId}`);
    }

    const newDamages = checkout.newDamages || [];
    const estimate = checkout.estimate || buildEstimate(newDamages, { rateCard });

    const checkin = await store.getInspection(bookingId, 'checkin');
    const claimer = getClaimer();

    const claimResult = await claimer.fileClaim({
      bookingId,
      vehicle: checkout.vehicle,
      policyRef,
      incidentDate: checkout.completedAt || new Date().toISOString(),
      newDamages,
      estimate,
      evidence: {
        checkinReportUrl: checkin?.reportUrl,
        checkoutReportUrl: checkout.reportUrl,
      },
    });

    await store.saveClaim(bookingId, claimResult);
    return claimResult;
  }

  /**
   * Get complete damage inspection report for a booking.
   *
   * @param {string} bookingId
   */
  async function getReport(bookingId) {
    const [checkin, checkout, claim] = await Promise.all([
      store.getInspection(bookingId, 'checkin'),
      store.getInspection(bookingId, 'checkout'),
      store.getClaim(bookingId),
    ]);

    const newDamages = checkout?.newDamages || (
      checkout && checkin ? diffDamages(checkin.damages || [], checkout.damages || [], { minConfidence }) : (checkout?.damages || [])
    );

    const estimate = checkout?.estimate || buildEstimate(newDamages, { rateCard });

    return {
      bookingId,
      hasCheckin: Boolean(checkin),
      hasCheckout: Boolean(checkout),
      checkin: checkin || null,
      checkout: checkout || null,
      newDamages,
      estimate,
      claim: claim || null,
      summary: {
        status: !checkout
          ? (checkin ? 'checked_in' : 'not_started')
          : checkout.provider === 'pickandsync-local'
          ? 'pending_review'
          : newDamages.length === 0
          ? 'passed_clean'
          : 'damage_detected',
        damageCount: newDamages.length,
        totalEstimatedRepair: estimate.total,
        claimStatus: checkout?.provider === 'pickandsync-local' ? 'disabled' : (claim?.status || (newDamages.length === 0 ? 'no_claim_needed' : 'pending')),
      },
    };
  }

  return {
    store,
    recordCheckin,
    recordCheckout,
    getInspection,
    fileClaim,
    getReport,
  };
}

// Default shared service singleton
export const damageInspectionService = createDamageInspectionService();

export { diffDamages } from './compare.js';
export { buildEstimate, DEFAULT_RATE_CARD } from './estimate.js';
export { createMemoryStore } from './store.js';
export { createFileStore } from './fileStore.js';
export { getInspectionProvider } from './providers/inspection/index.js';
export { getClaimsProvider } from './providers/claims/index.js';
