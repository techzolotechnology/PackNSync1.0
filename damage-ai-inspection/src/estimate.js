/**
 * Turn a list of new damages into an itemised repair estimate (INR).
 *
 * The rate card below is a configurable placeholder. In production it should come
 * from your workshop pricing or the insurer's agreed schedule — pass your own
 * `rateCard` to buildEstimate() to override. Amounts are indicative only; the
 * claims provider (Tint / LULA) makes the binding decision.
 */

// Base repair cost by damage type and severity, in rupees.
export const DEFAULT_RATE_CARD = {
  scratch: { minor: 1500, moderate: 3500, severe: 7000 },
  chip: { minor: 800, moderate: 1800, severe: 3500 },
  dent: { minor: 2500, moderate: 6000, severe: 12000 },
  crack: { minor: 3000, moderate: 8000, severe: 18000 },
  broken: { minor: 4000, moderate: 12000, severe: 28000 },
  missing: { minor: 5000, moderate: 15000, severe: 35000 },
};

// Some panels cost more to refinish/replace than the base type rate implies.
const PART_MULTIPLIER = {
  windshield: 1.8,
  bonnet: 1.3,
  'front-bumper': 1.2,
  'rear-bumper': 1.2,
  door: 1.15,
  'left-door': 1.15,
  'right-door': 1.15,
  'fuel-tank': 1.25,
  alloy: 1.4,
};

const GST_RATE = 0.18;

const round = (n) => Math.round(n);

/**
 * @param {import('./types.js').DamageFinding[]} damages
 * @param {{ rateCard?: object, taxRate?: number, cap?: number }} [opts]
 * @returns {import('./types.js').RepairEstimate}
 */
export function buildEstimate(damages, opts = {}) {
  const rateCard = opts.rateCard || DEFAULT_RATE_CARD;
  const taxRate = opts.taxRate ?? GST_RATE;

  const items = damages.map((d) => {
    const base = rateCard[d.type]?.[d.severity] ?? 0;
    const mult = PART_MULTIPLIER[d.part] ?? 1;
    return {
      part: d.part,
      type: d.type,
      severity: d.severity,
      amount: round(base * mult),
    };
  });

  let partsAndLabour = items.reduce((sum, i) => sum + i.amount, 0);
  // Optional cap (e.g. the security deposit or the policy limit).
  if (opts.cap != null) partsAndLabour = Math.min(partsAndLabour, opts.cap);

  const tax = round(partsAndLabour * taxRate);
  return {
    items,
    partsAndLabour,
    tax,
    total: partsAndLabour + tax,
    currency: 'INR',
  };
}
