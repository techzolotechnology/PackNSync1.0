# Project review — 12 October 2026

**Follow-up implementation:** the owned inspection now uses private PostgreSQL evidence, local decoded-image comparison, web/mobile capture, signoff, audited admin review and payout holds. See [current validation](Damage%20AI%20Inspection/VALIDATION.md) and [rollout](Damage%20AI%20Inspection/RUNBOOK.md). The findings below record the earlier review; the added implementation addresses the earlier inspection/storage/review/mobile gaps in code. Production rollout and trained damage recognition remain outstanding.

## Scope and conclusion

Reviewed current backend entry points, authentication, booking/inspection controllers, expense routes, payout-release logic, notification helpers, upload handling, Prisma model inventory, web inspection/SEO, mobile screen registrations and CI/deployment configuration. This is a source review of the local checkout, not verification of production settings or an exhaustive penetration test. Production dashboards, secrets, real payments, all UI screens and the Android binary were not tested in this pass.

PickAndSync has substantial marketplace infrastructure: rentals, wallets, promotions, trip expenses, admin tools and disputes. Its inspection implementation was a simulation presented as a real AI/insurance feature. Replacing that misleading implementation is the first priority for an owned service.

## Findings and priorities

| Priority | Finding with source | Action |
|---|---|---|
| High, addressed | Stock photos and URL tags were exposed in frontend/src/components/DamageInspectionModal.jsx as AI scan results. | Replaced with real six-view capture and explicit user condition notes. |
| High, addressed | damage-ai-inspection defaulted to mock inspection/claim providers; stub vendor code contained unverified HTTP endpoints. | Owned provider is selected regardless of old provider environment settings. External adapter files now reject calls. Mock fixtures remain only for explicit test injection. |
| High, addressed | backend/src/services/damageInspection.service.js described verified clean returns, released deposits and insurance coverage without performing those actions. | Removed those notifications and automatic report resolution. No financial action now occurs. |
| High, addressed | Inspection snapshots could be replaced, checkout had no mandatory baseline, and file write/read errors were hidden. | Immutable snapshots, matching pickup requirement, atomic local writes, surfaced corruption/storage failures. |
| High, pending | Evidence JSON and other upload handlers use disk. Render configuration is free-tier and current actual deployment durability is not verified. | Durable private evidence storage, backups, access audit and retention/deletion policy before rollout. |
| High, pending | New inspection workflow has no completed reviewer decision, dispute-to-payout hold integration, or both-party signoff. | Add those before any damage charge or automatic financial action. Current result always awaits review. |
| Medium, pending | backend/src/routes/expense.routes.js validates individual shares but does not require their sum to equal the expense or reject repeated user IDs. | Validate balanced splits, duplicate participants, currency/date inputs and money precision. |
| Medium, pending | reportUpload.middleware.js accepts declared MIME type. Local inspection checks signatures but does not fully decode server-side images. | Server decoder, dimension/pixel limits, re-encoding and safe private delivery. |
| Medium, pending | CI permits lint failure through continue-on-error and checks syntax only on backend index.js. The standalone inspection tests are not in CI. | Make lint blocking; run inspection tests and exercise changed routes in CI. |
| Medium, pending | auth.controller.js stores one refresh token per user; new logins can invalidate other sessions. | Decide multi-device behavior, add per-device revocation and robust token rotation tests. |
| Medium, pending | frontend/src/seo/seoConfig.js claims UPI expense settlement and verified travel buddies. Implemented capability and verification status need to match each claim. | Audit marketing copy against actual settlement and KYC flows. |
| Medium, pending | Mobile registered screens cover Home/Trips/Rentals/Bookings/Wallet/Host/Account. Inspection capture parity is absent. | Add owned mobile capture with the same validation and evidence-review semantics after storage is ready. |
| Medium, pending | notifyUser invokes push, but not all direct/bulk notification writes use this helper. | Test push provisioning, delivery receipts, token cleanup and event coverage. |
| Deployment risk | render.yaml describes Docker, while historical deployment used native Node. | Confirm actual build/start commands and include migration deployment with rollback planning. Do not assume blueprint values are live settings. |

## Owned detection roadmap

The useful first release is evidence collection and human review, implemented now. An actual AI damage detector needs a consented, labeled dataset; model training; vehicle-separated evaluation; image-quality/angle alignment checks; and thresholds measured against false accusations. Basic before/after pixel differences cannot distinguish scratches from glare, dirt, shadows or camera movement reliably. No recognition accuracy is claimed by this project.

Use the implementation notes in Damage AI Inspection/README.md. Keep claim submission disabled and require a repair quote and human decision. Insurance partnership is separate from owning the detection technology.

## Verification this pass

15 standalone module tests passed: 8 owned-workflow tests and 7 explicitly injected legacy mock/utility tests. Backend changed controllers/services pass Node syntax checks; the replaced JSX compiles with esbuild. These checks do not exercise a production database, payment, browser camera device or AI model.

Full frontend build was attempted in an isolated copy but blocked by missing date-fns in the available dependency installation; a complete build is not verified. No production deployment was performed.
