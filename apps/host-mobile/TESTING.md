# Host app acceptance checks

## Automated

From the repository root:

```sh
npm test --workspace=apps/host-mobile
npm test --workspace=backend
npm run lint --workspace=apps/host-mobile
npm run build:android:bundle --workspace=apps/host-mobile
npm run build:host:web
```

Host tests cover token rotation under concurrent requests, saved-session restoration, invalid credentials, sign-out during refresh/storage loading, offline errors, multipart retry boundaries, no automatic withdrawal retries, host amounts versus platform fees, dates and paid-only calendar events.

Backend tests cover private host filtering, ownership, mass-assignment rejection, SQL-like text as parameterized data, malformed inputs, reservation conflicts, verification gates, booking/listing races, stale decisions and earnings beyond 50 records. Database calls are mocked; these tests do not prove live PostgreSQL concurrency or payment-provider delivery.

## On-device / staging

The optional `scripts/ui-smoke.cjs` check uses Playwright against the exported web app with an intercepted API. It covers OTP screens, fleet edits, booking decisions, calendar navigation, withdrawal review without a payout, profile updates, sign-out and phone/tablet layouts. Install Playwright with Chromium in your testing environment, or set `PLAYWRIGHT_PACKAGE` to an existing Playwright package and `HOST_BROWSER_CHANNEL=chrome` to use an installed Chrome in an isolated test session. The script never uses your signed-in browser profile or calls the live API.

Use accounts you control and sandbox payments.

| Check | Expected result |
| --- | --- |
| Existing email login | Same host vehicles/bookings as website |
| Invalid/expired OTP | Error; no dashboard access |
| New registration | No fabricated vehicles or revenue |
| Force-close/reopen | Native session restored |
| Authenticated offline launch | Retry screen preserves saved authentication |
| Parallel expired requests | One refresh; no inconsistent sign-out |
| Switch accounts | No previous host's fleet, wallet or bookings |
| Incomplete identity | Publication rejected; link to verification |
| Unchecked listing terms | Gated action remains disabled |
| Camera/library permissions | Clear recovery when denied; supported uploads work |
| Unsupported/large photo | Explain formats/size; no misleading success |
| RC submission and retry | Real review status; retry on same car without duplication |
| Unauthenticated host listings | 401; another account's listings inaccessible |
| Date edit excluding a reservation | 409; original reservation retained |
| Pause with future reservation | New requests stop; reservation retained |
| Price edit | Existing booking total unchanged |
| Guest cancel racing host approval | A single state transition wins |
| Accepted request | Guest still needs to pay |
| Paid schedule | Only paid reservation pickups/returns appear |
| Held/released earning | Correct separation from cash available to withdraw |
| Withdrawal review | Amount/destination confirmed before submission |
| Interrupted withdrawal | Check activity before retry; no silent duplicate retry |
| Mock payout | Explicitly says no real funds moved |
| Back/tabs/rotation/keyboard | Stable layout and reachable form actions |
| Read inbox | Unread badge and persisted read state agree |

Backend changes must be deployed and native checks must pass before wider APK distribution. Store publication is not part of a bundle export.

## Category and charter checks (1.1.0)

The automated UI check now also covers category selection for car/bike/scooter/helicopter, category filtering, helicopter publication after review, and a charter quote without wallet movement. Unit tests cover expiry dates, review ownership, capacity, client attempts to set approval fields, public document redaction and road/aircraft separation.

For an integration check using a **new isolated local PostgreSQL**, with no production database access:

```sh
npm install --prefix .tmp-host-pg embedded-postgres@17.10.0-beta.17
node backend/scripts/test-host-categories-postgres.mjs
```

This starts and stops its own PostgreSQL process, overrides database URLs to loopback, creates a dedicated test database, applies the exact new migration SQL, and exercises real persistence, operator review/publication, enquiry quotes, expired-document visibility, the booking/listing lock race and paid-reservation date protection. Test data stays in the ignored `.tmp-host-pg` directory. The check does not verify real operator documents, regulatory authority or payment-provider delivery.
