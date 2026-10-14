/**
 * Work out which damages are NEW at drop-off — i.e. present at check-out but not
 * at check-in. This is the core of fairness: a renter is only charged for damage
 * that appeared during their trip.
 *
 * FocalX can also return "new damage" alerts directly (it keys history to the VIN),
 * so a real adapter may override this with the provider's own diff. We keep a
 * provider-agnostic fallback here so the module works with any inspection source.
 */

/** Two findings are "the same damage" if they're on the same part and of the same type. */
const sameSpot = (a, b) => a.part === b.part && a.type === b.type;

/**
 * @param {import('./types.js').DamageFinding[]} checkin
 * @param {import('./types.js').DamageFinding[]} checkout
 * @param {{ minConfidence?: number }} [opts]
 * @returns {import('./types.js').DamageFinding[]} new damages only
 */
export function diffDamages(checkin, checkout, opts = {}) {
  const minConfidence = opts.minConfidence ?? 0.6;
  const priorBySpot = new Map();
  for (const d of checkin) priorBySpot.set(`${d.part}::${d.type}`, d);

  return checkout.filter((d) => {
    if (d.confidence < minConfidence) return false; // too unsure to charge anyone for
    const prior = priorBySpot.get(`${d.part}::${d.type}`);
    if (!prior) return true; // not seen before -> new
    // Same spot existed before, but got worse -> treat as new/aggravated.
    return severityRank(d.severity) > severityRank(prior.severity);
  });
}

const RANK = { minor: 1, moderate: 2, severe: 3 };
export const severityRank = (s) => RANK[s] || 0;
