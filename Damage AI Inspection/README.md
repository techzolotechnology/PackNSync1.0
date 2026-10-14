# PickAndSync owned vehicle inspection

The production implementation lives in this directory and uses PickAndSync's backend, PostgreSQL and local image processing. It does not call an external inspection provider.

## Included

- Guided web/mobile pickup and return capture, condition notes, odometer/fuel readings and consent.
- Immutable private photo evidence, safe image decoding and SHA-256 fingerprints.
- Local photo-quality checks and visual-change regions for human review.
- Host/renter acknowledgements, disputes, admin MFA review, workshop quotes and event history.
- Booking-linked payout holds, vehicle-history filtering and JSON export.
- Migration, CI tests and mobile v1.0.5 permission/build configuration.

Read [RUNBOOK.md](RUNBOOK.md) for deployment and operating instructions and [VALIDATION.md](VALIDATION.md) for completed checks.

## Important limit

The engine highlights visual changes; it is not a trained scratch/dent classifier. Reliable automated recognition still requires labeled vehicle photos, model training and evaluation. Review does not automatically charge a wallet, release a deposit or submit insurance claims.

This implementation has passed local software checks, but production migration/deployment and real-device camera testing have not occurred. Start with a reviewed pilot after those rollout checks.
