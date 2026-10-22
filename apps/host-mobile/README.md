# PickAndSync Host

A separate Expo app for car, bike, scooter and helicopter hosts, connected to the existing PickAndSync API. It installs alongside the guest app and uses the same email account. Version 1.1.0 adds all four hosting categories.

## Included workflows

- Email OTP sign-in/registration, native encrypted refresh-token storage and session recovery.
- Dashboard with real fleet counts, requests, wallet cash and upcoming earnings.
- Category selection and fleet filters for cars, bikes, scooters and helicopters, with suitable seat/fuel/transmission defaults.
- Road vehicle creation/editing, photos, RC submission and daily listings.
- Helicopter operator details, indicative hourly rates, private document uploads, review and publication for charter enquiries.
- Wallet and paid rental schedules cover road rentals. Helicopter quotes do not create reservations, charge customers or credit host earnings.
- Listing creation after identity/RC approval and explicit listing-terms acceptance.
- Price, pickup location, description and availability editing; pause/resume listings.
- Booking accept/decline confirmations, status filters and a paid pickup/return calendar.
- Pending, held and released earnings; cash withdrawals to UPI/bank with a review step.
- Account editing, notification inbox, wallet activity and verification/support links.
- Foreground refresh, pull to refresh, Android back navigation and safe areas.

No demo users, simulated revenue, automatic approvals or fake inspection results are included in the app.

## Run and verify

From the repository root:

```sh
npm ci
npm run dev:host
npm run web --workspace=apps/host-mobile
npm run build:host:web
npm run build:android:bundle --workspace=apps/host-mobile
npm run test:host
npm run lint --workspace=apps/host-mobile
```

For another backend, copy this directory's `.env.example` to `.env` and set the full reachable `/api` address. A physical phone cannot use your computer's `localhost`.

Exports go to `dist/web` and `dist/android`. Android JavaScript/assets export is a bundle check, not an installable APK. Web sessions are memory-only; native refresh credentials use SecureStore.

## Build an APK

This app has its own EAS project, display name **PickAndSync Host**, slug `pickandsync-host`, Android/iOS identifier `com.pickandsync.host` and scheme `pickandsynchost`. The original PickAndSync icon is retained. Keep the separate Android signing credentials backed up in the Expo account.

```sh
cd apps/host-mobile
npx eas-cli build --platform android --profile preview
```

The preview profile produces an APK; production produces an Android App Bundle. iOS signing, Apple membership and device testing remain necessary before iOS distribution.

## Deploy the backend changes first

Apply migration **20261021180000_hosting_categories_charters** before deploying the updated backend and distributing the new host app. It adds aircraft operator profiles and charter enquiries; existing road vehicles remain intact. See [HOSTING_CATEGORIES.md](HOSTING_CATEGORIES.md) for deployment and operator-review instructions.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/rentals/listings/host` | Authenticated host's listings, including paused listings |
| `PATCH /api/rentals/listings/:id` | Owner-only price, description, location, dates and status edits |

Private listings are scoped to the authenticated account. Update requests cannot change host, vehicle, currency/country or nested Prisma relations. Date edits cannot exclude upcoming pending, confirmed or paid reservations. Edits share the booking advisory lock; booking creation rechecks the listing after acquiring it. Agreed booking totals remain unchanged.

Host decisions now claim only a still-pending booking. Earnings summaries aggregate the full history while the app displays the latest 50 earning records. Other actions use existing vehicle, verification, policy, booking, wallet and notification APIs.

## Product boundaries

- Identity documents are completed on the website with the same email. RC photos can be submitted in this app. Server verification controls publication.
- New listings default to India/INR, matching the currently enabled payment/KYC market. Existing listings retain their currency. This app does not enable foreign markets.
- Scheduled pickup/return dates do not record physical handovers. This checkout has no inspection/handover API; the app does not claim AI damage detection or insurance cover.
- The inbox refreshes when active, once per minute and on return. Background push is not configured for this separate app.
- Payout/test status comes from the server. A queued withdrawal is not presented as completed. Interrupted requests instruct the host to check wallet activity before retrying.
- The backend currently stores one refresh token per user. Signing in elsewhere can end an earlier session on its next refresh. Independent simultaneous device sessions need a separate backend change.
- RC storage durability and payout-provider availability remain deployment responsibilities inherited from the existing backend.
- Aircraft evidence also requires durable private storage. Cloudinary uploads use authenticated access when configured. Local files are admin-only but inherit Render's ephemeral-disk limitation. An upload or platform review is not government certification or permission to fly.

See [TESTING.md](TESTING.md) for device/staging checks. No real OTPs, customer documents or payouts are exercised by automated tests.
