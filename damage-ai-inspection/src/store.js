/**
 * Persistence seam. The workflow only needs these four methods, so the backend
 * can supply a Prisma-backed implementation (see prisma/ + backend-integration/)
 * while tests and local runs use this in-memory one.
 *
 * @typedef {Object} InspectionStore
 * @property {(bookingId: string, stage: string, result: object) => Promise<object>} saveInspection
 * @property {(bookingId: string, stage: string) => Promise<object|null>} getInspection
 * @property {(bookingId: string, claim: object) => Promise<object>} saveClaim
 * @property {(bookingId: string) => Promise<object|null>} getClaim
 */

/** @returns {InspectionStore} */
export function createMemoryStore() {
  const inspections = new Map(); // key: `${bookingId}:${stage}`
  const claims = new Map(); // key: bookingId

  return {
    async saveInspection(bookingId, stage, result) {
      if (inspections.has(`${bookingId}:${stage}`)) {
        const error = new Error('Inspection evidence cannot be overwritten.');
        error.statusCode = 409;
        throw error;
      }
      const record = { bookingId, stage, ...result, savedAt: new Date().toISOString() };
      inspections.set(`${bookingId}:${stage}`, record);
      return record;
    },
    async getInspection(bookingId, stage) {
      return inspections.get(`${bookingId}:${stage}`) || null;
    },
    async saveClaim(bookingId, claim) {
      const record = { bookingId, ...claim };
      claims.set(bookingId, record);
      return record;
    },
    async getClaim(bookingId) {
      return claims.get(bookingId) || null;
    },
  };
}
