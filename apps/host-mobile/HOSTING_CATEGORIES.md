# Hosting categories — version 1.1.0

| Category | Host details | Listing / customer flow |
| --- | --- | --- |
| Car | Registration, make/model, year, seats, fuel, transmission, photos, RC | Verified daily rental listing; existing booking/wallet flow |
| Bike | Same road-vehicle details; default two seats and manual transmission | Existing daily rental booking flow |
| Scooter | Same road-vehicle details; default two seats and automatic transmission | Existing daily rental booking flow |
| Helicopter | Aircraft registration, manufacturer/model, year, passenger seats excluding crew, operator name, permit reference, base airport/helipad, indicative hourly rate | Operator review, publication for enquiries, route/date/passenger requests and full-price operator quotes |

## Helicopter setup

1. In the host app, choose **Fleet → Add vehicle → Helicopter**.
2. Save the aircraft and operator details. The aircraft is a draft, not a published daily rental.
3. Open **Charter setup**. Upload registration, operator-permit, airworthiness and insurance photos. Enter future validity dates for the latter three documents. JPG/PNG/WEBP up to 8 MB are supported; PDFs are not currently accepted.
4. Submit for review. An admin uses **Trust → Helicopter operators**, opens the private evidence, checks operator authority and document validity, records findings, and approves or rejects the listing review.
5. An approved host must separately choose **Publish for charter enquiries**. Editing operator details or replacing evidence pauses publication and resets review. Expired evidence prevents publication, public directory visibility and new quotes.
6. Customers use **/helicopter-charters/** to send route, date and passenger requirements. The host responds under **Bookings → Helicopter enquiries** with a complete quote, conditions and next steps for confirmation.

Charter enquiries/quotes are not paid reservations, flight clearances, insurance coverage or guarantees of operational availability. This version does not collect charter payments, create helicopter wallet earnings or record confirmed flight handovers. Those need a separate confirmation/payment workflow and operational arrangements with the operator.

## Backend and deployment

New database migration: `backend/prisma/migrations/20261021180000_hosting_categories_charters/migration.sql`.

From the repository root, on the intended deployment environment:

```sh
npx prisma migrate deploy --schema=backend/prisma/schema.prisma
npm run build:backend
```

Then deploy the backend and website, followed by host APK 1.1.0 (Android version code 2). This work does not execute production migrations or deploy your services automatically. The application identifier and signing key stay the same as the separate 1.0.0 host app, so this is an update to that app.

New API groups:

- `/api/aviation/aircraft`: public, reviewed and published listings, with private evidence and permit references removed.
- `/api/aviation/aircraft/:vehicleId`: owner-only operator profile edits, document uploads, review submission and publication controls.
- `/api/aviation/inquiries/host` and `/my`: records scoped to the current host or requester.
- `/api/aviation/inquiries/:id/respond` and `/cancel`: quotes/declines and requester cancellations, with guarded state changes.
- `/api/admin/aviation`: review queue and private document access behind the existing admin role and MFA gates.

The road-rental creation, booking, quote and wallet-payment endpoints reject helicopters. Unknown vehicle types are rejected instead of being converted to cars. Private aircraft evidence uses authenticated Cloudinary storage when configured; local fallback files need persistent storage to survive a Render redeploy.

## Operational reference

India's non-scheduled aviation framework treats helicopter operations separately from road rentals. See the [Ministry of Civil Aviation's published DGCA requirements](https://www.civilaviation.gov.in/sites/default/files/migration/D3C-C3.pdf) and [current DGCA regulations](https://www.dgca.gov.in/digigov-portal/?page=aviation-regulations). These links provide context for manual operator checks; this software does not determine regulatory compliance or issue operating permission.

## Checks before release

- Host unit tests cover category serialization, two-wheeler seating and operator fields.
- Backend tests cover publication/ownership, document expiry, review reset, public redaction, quote capacity, stale enquiry transitions and rental/charter separation.
- The local phone/tablet UI test covers all four category forms, fleet filtering, helicopter publication and quotes without wallet payments, alongside existing rental flows.
- Run native device checks for camera/gallery, private uploads and session persistence after deploying the migration and services. No real operator documents or payments are used in the automated checks.
