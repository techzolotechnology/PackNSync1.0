# Validation — 12 October 2026

## Optional scratch notes update — 14 October 2026

All 23 owned inspection tests passed, including skipped notes and scratch-to-photo association. The changed web component passed ESLint and Android JavaScript export passed. Native Hermes bytecode generation could not start its compiler in the local environment (spawn UNKNOWN); this update still requires a fresh APK build/device check. The earlier checks below describe the original implementation.

Checks used isolated clean dependency installations and a disposable localhost PostgreSQL 17 database named inspection_test. No production database, customer account, payment or external inspection provider was used.

| Check | Result |
|---|---|
| Clean root npm ci, final dependency lock | Passed |
| Existing backend Vitest suite | 66 tests passed |
| Owned image/workflow/vision tests | 21 tests passed |
| PostgreSQL SQL migration fixture | Passed |
| PostgreSQL transaction integration | Passed |
| HTTP routes/JWT/MFA integration | Passed |
| Legacy explicitly injected fixture tests | 15 passed; these do not prove real AI behavior |
| Prisma schema validation/client generation | Passed, pinned 5.22.0 |
| Frontend ESLint | 0 errors, 17 pre-existing warnings |
| Frontend production compilation | Passed in clean source copy |
| Android Expo/Hermes export | Passed, 785 modules, approximately 2.29 MB bundle |
| Changed backend syntax and tracked diff whitespace | Passed |

The clean frontend source copy omitted public static assets; two existing stock-image references were reported for runtime resolution. The repository's public files remain unchanged. This was a compilation check, not a visual browser/device acceptance test.

## Integration coverage

- Concurrent identical submissions create one snapshot and one set of six photos in PostgreSQL.
- Different retries cannot overwrite submitted evidence.
- Return needs pickup; odometer cannot decrease; consent and valid bounded readings are required.
- Real JPEG/PNG bytes are decoded; malformed, mislabeled, repeated and remote-URL inputs are rejected.
- Private images reject unrelated accounts, require authentication, and use no-store response headers.
- Opaque-origin pages cannot access evidence using cookies alone; signed app bearer access remains supported.
- Admin review routes and admin access to customer inspection routes require MFA.
- Both-party acknowledgements precede passing; participants cannot review their own rental as admin.
- A stale review cannot overwrite a new dispute.
- New/reopened booking reports share the payout lock; a reply to a closed report stays closed.
- Pending inspection earnings are blocked. A valid pass permits exactly one host wallet credit in the local test database.
- Unrelated open reports prevent clearing the hold. Quote recording does not deduct any wallet money.
- Insurance submission remains disabled; the rollout switch returns unavailable when disabled.

## Remaining rollout work

Apply migration on the deployed database, deploy backend/web, rebuild/install the native binary, verify actual camera permissions and signoff on devices, and confirm database backup/retention procedures. Docker recipe changes were source-reviewed but no Docker image was built here. iOS native compilation was not performed.

No real labeled damage dataset/model or recognition accuracy benchmark exists in this change. Synthetic visual-change tests validate code behavior, not damage-recognition accuracy.
