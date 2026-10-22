/**
 * Shared type contracts for the damage-inspection module (JSDoc only — no runtime).
 * These define the boundary every provider adapter must satisfy, so FocalX, Tint
 * and LULA can be swapped for the mocks without touching the workflow.
 */

/**
 * @typedef {'checkin' | 'checkout'} InspectionStage
 * One rental produces two inspections: before pickup and after return.
 */

/**
 * @typedef {Object} VehicleRef
 * @property {string} vehicleId   PickAndSync vehicle id.
 * @property {string} [vin]       VIN / chassis number — FocalX keys its damage history to this.
 * @property {string} [plate]     Registration plate, for the human-readable report.
 * @property {'CAR'|'BIKE'|'SCOOTER'} [type]
 */

/**
 * @typedef {Object} InspectionImage
 * @property {string} url         Publicly fetchable (or signed) image URL.
 * @property {string} [angle]     e.g. 'front', 'rear', 'left', 'right', 'front-left'...
 */

/**
 * @typedef {Object} DamageFinding
 * A single piece of damage the inspection AI reports.
 * @property {string} id
 * @property {string} part        e.g. 'front-bumper', 'left-door', 'fuel-tank'.
 * @property {'scratch'|'dent'|'crack'|'chip'|'missing'|'broken'} type
 * @property {'minor'|'moderate'|'severe'} severity
 * @property {number} confidence  0..1.
 * @property {number[]} [bbox]     [x, y, w, h] on the matched image, if provided.
 * @property {string} [imageUrl]   The image the damage was seen on.
 */

/**
 * @typedef {Object} InspectionResult
 * The provider's analysis of one image set.
 * @property {string} providerInspectionId  Provider's own id (system of record).
 * @property {string} provider              'focalx' | 'mock'.
 * @property {InspectionStage} stage
 * @property {VehicleRef} vehicle
 * @property {DamageFinding[]} damages
 * @property {string} completedAt           ISO timestamp.
 * @property {string} [reportUrl]           Link to the provider's visual report.
 */

/**
 * @typedef {Object} RepairLineItem
 * @property {string} part
 * @property {string} type
 * @property {string} severity
 * @property {number} amount        Currency minor-unit-safe number (rupees).
 */

/**
 * @typedef {Object} RepairEstimate
 * @property {RepairLineItem[]} items
 * @property {number} partsAndLabour
 * @property {number} tax
 * @property {number} total
 * @property {string} currency      'INR'.
 */

/**
 * @typedef {Object} ClaimPayload
 * What we send to the claims provider (Tint / LULA) to auto-adjudicate.
 * @property {string} bookingId
 * @property {VehicleRef} vehicle
 * @property {string} [policyRef]   The embedded-insurance policy bound at booking.
 * @property {string} incidentDate  ISO; the return time.
 * @property {DamageFinding[]} newDamages
 * @property {RepairEstimate} estimate
 * @property {Object} evidence
 * @property {string} [evidence.checkinReportUrl]
 * @property {string} [evidence.checkoutReportUrl]
 * @property {InspectionImage[]} [evidence.images]
 */

/**
 * @typedef {Object} ClaimResult
 * @property {string} claimId
 * @property {string} provider              'tint' | 'lula' | 'mock'.
 * @property {'auto_approved'|'needs_review'|'rejected'} status
 * @property {number} [payout]              Approved amount, if any.
 * @property {string} [reason]
 * @property {string} decidedAt
 */

/**
 * An inspection provider (FocalX or the mock) must implement this shape.
 * @typedef {Object} InspectionProvider
 * @property {(input: { vehicle: VehicleRef, stage: InspectionStage, bookingId: string, images: InspectionImage[] }) => Promise<InspectionResult>} inspect
 * @property {string} name
 */

/**
 * A claims provider (Tint, LULA or the mock) must implement this shape.
 * @typedef {Object} ClaimsProvider
 * @property {(payload: ClaimPayload) => Promise<ClaimResult>} fileClaim
 * @property {string} name
 */

export {};
