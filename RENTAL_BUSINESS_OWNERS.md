# Rental business owners

Website: sign in → Host a Vehicle → How do you host? → Car / bike rental shop owner.
App: Host → How do you host? → Rental shop owner.

Save the business name, address, contact number and registration/rental permit reference. GST is optional. Admin → Rental businesses contains the review queue; admins must record their checks or rejection reason. This is manual business review, not automated regulatory verification. No shop can approve itself. Reviews use the existing admin MFA and audit log.

One account manages multiple vehicles with the existing fleet dashboard, pricing, availability and booking approvals. Each vehicle still requires RC approval and the host's existing identity and terms checks. Shop listings are hidden from rental search and cannot receive new bookings until the business is approved. Editing business details resets review to pending; existing bookings remain accessible. Public rental cards show the shop name and an approval badge, never private phone, GST or registration data. Individual hosts continue using their existing flow.

Deployment: run `npm run db:deploy --workspace=backend`, regenerate Prisma, deploy backend and web together, then rebuild the APK to expose the mobile form. No new fees or payment rules are introduced.

Validation (14 October 2026): 84 backend tests passed, including 18 business validation / ownership / stale-review cases. Prisma 5.22 schema validation passed. Changed web components passed lint (three existing warnings), and the production web build passed. Android JavaScript export passed; no APK was built or physical device tested in this change. The migration has not been applied to production.
