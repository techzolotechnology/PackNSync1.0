# Owned inspection deployment and operation

Implemented 12 October 2026. No external inspection service is called.

## Reference analysis

FocalX's [rental workflow](https://focalx.ai/car-rental/) describes guided capture, condition reports, mileage/fuel records and dashboard review. Its [platform](https://focalx.ai/) describes vehicle history and structured evidence; its FAQ says the AI is pretrained and validated during onboarding. These public descriptions informed our workflow. We have not copied its model, assets or claimed performance.

## Workflow

1. Paid renter or host opens Vehicle inspection on a booking, on web or mobile.
2. Capture front, rear, left, right, windshield and interior. Add condition notes, optional odometer/fuel readings, and storage consent.

Scratch notes are optional on web and mobile. After capturing a view, customers can add a scratch/damage description linked to that photo or choose Skip notes. The interface recommends recording visible marks before pickup. Skipping is stored as not_reported, not as a damage-free declaration.
3. Server decodes bounded JPEG/PNG images with Sharp, strips metadata from display copies, fingerprints submitted bytes and stores original/display bytes privately in PostgreSQL. Snapshots are immutable; exact retries are idempotent.
4. The other party acknowledges evidence. At return repeat the views; mileage cannot decrease. Admins cannot sign for a party.
5. Our local engine checks brightness and blur/texture, adjusts limited translation/illumination, and highlights changed regions. Poor quality or framing yields inconclusive results. These are review aids, not scratch/dent classifications.
6. A party can dispute evidence, creating or linking a real Reports and Disputes record.
7. Admin → Inspections offers filters, private side-by-side evidence, acknowledgements and human decisions. Admin authorization/MFA are required. Self-review is blocked; stale reviews require refresh.
8. PASSED requires both parties' pickup and return acknowledgements. Confirmed damage can have a referenced workshop quote. Quotes do not charge wallets or establish legal liability.
9. Started inspections hold pending host earnings. Unresolved inspections block manual and scheduled release. Passing clears only an inspection hold when no other report is open. Late disputes cannot recover released earnings.
10. JSON export includes metadata, hashes, readings, acknowledgements and event history. Authorized image paths are included; public links and original binaries are not.

## Deployment

Install from repository root with `npm ci`. Use existing database settings; no inspection-provider credentials are needed. Back up the database, then apply migration `20261012120000_owned_inspections` using `npm run db:deploy --workspace=backend`. Generate the client with `npm run build:backend` and deploy backend/web together.

`INSPECTIONS_ENABLED=false` disables endpoints during rollout/rollback. Enable after migration and pilot checks. Native Android/iOS must be rebuilt because camera/library modules and permissions changed. Existing APKs do not contain this implementation.

Include migration deployment in the actual release pipeline. The blueprint is not proof of current Render runtime settings. This local change has not migrated or deployed production.

Use database backups/access controls. BYTEA evidence survives API deployment but consumes database capacity: monitor and budget storage. Decide retention/deletion and support-access policy before customer capture. Originals may retain camera metadata; display endpoints do not expose originals.

## Verification

- `node --test "Damage AI Inspection/test/*.test.mjs"`
- `node --test damage-ai-inspection/test/*.test.js` — explicit legacy mock fixtures
- `npm run lint --workspace=frontend`
- `npm run build --workspace=frontend`
- From apps/mobile: `npx expo export --platform android`

The optional PostgreSQL integration script uses an empty localhost database named inspection_test. Initialize its test schema, set INSPECTION_TEST_DATABASE_URL, and run `node "Damage AI Inspection/test/database.integration.mjs"`. It rejects remote URLs and cleans its seeded booking/users.

## Pilot acceptance

Check real cameras on Android/iOS/web; distinct photos; corrupt/oversized rejection; cross-account image denial; two-party acknowledgements; immutable retry conflicts; stale-review denial; export; disputes; payout blocking; unrelated holds; backup/restore; native permissions; and deployed migrations.

## AI limitation

This implementation supplies local visual-change analysis and a human-review workflow. It does not contain a trained scratch/dent recognition model. Differences may be glare, dirt, background movement or perspective. Similar photos are not proof of no damage. Reliable automatic recognition requires consented labeled photos, vehicle-separated model evaluation and a reviewed release threshold. No accuracy percentage, insurer settlement or automatic charge is promised. Repair quotes come from humans, not invented rates.
