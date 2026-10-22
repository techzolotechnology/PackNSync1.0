import { randomUUID } from 'node:crypto';

/**
 * Mock claims adjudicator. Applies a simple auto-adjudication policy so the
 * end-to-end flow produces a decision without Tint / LULA:
 *   - no new damage                      -> rejected (nothing to claim)
 *   - total <= AUTO_APPROVE_LIMIT and
 *     every finding is confident          -> auto_approved (payout = total)
 *   - otherwise                           -> needs_review
 *
 * Real adapters (tint.js, lula.js) return the provider's own decision instead.
 */
const AUTO_APPROVE_LIMIT = Number(process.env.CLAIM_AUTO_APPROVE_LIMIT || 25000);
const MIN_CONFIDENCE = 0.8;

/** @type {import('../../types.js').ClaimsProvider} */
export const mockClaimsProvider = {
  name: 'mock',
  async fileClaim(payload) {
    const decidedAt = new Date().toISOString();
    const claimId = `clm_${randomUUID()}`;

    if (!payload.newDamages?.length || payload.estimate.total <= 0) {
      return { claimId, provider: 'mock', status: 'rejected', reason: 'No new damage detected.', decidedAt };
    }

    const confident = payload.newDamages.every((d) => d.confidence >= MIN_CONFIDENCE);
    if (payload.estimate.total <= AUTO_APPROVE_LIMIT && confident) {
      return { claimId, provider: 'mock', status: 'auto_approved', payout: payload.estimate.total, reason: 'Within auto-approval limit.', decidedAt };
    }

    return {
      claimId,
      provider: 'mock',
      status: 'needs_review',
      reason: payload.estimate.total > AUTO_APPROVE_LIMIT ? 'Above auto-approval limit.' : 'Low-confidence findings.',
      decidedAt,
    };
  },
};
