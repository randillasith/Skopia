# Subscription plans and test payments

Skopia has **free videos** (public playback) and **premium videos** (requires a registered viewer with an active, unexpired subscription). The Browse page can show all, free, or premium titles. A locked premium title is visible in the catalogue but cannot play; the video-detail API omits its media URL. Locally uploaded premium media uses a short-lived signed URL and rechecks the subscription on every Range request, so cancelling revokes an already-issued URL.

## Database

With the normal MySQL/MariaDB configuration (`spring.jpa.hibernate.ddl-auto=update`), records are persisted in `subscription_plans`, `subscriptions`, and `payments`, linked to registered viewers. The payments panel (`/billing`) reads the viewer's own stored payment history from the database, not browser-local sample data. `/subscription` reads the current subscription. Demo plan rows (`MONTHLY`, `YEARLY`) are seeded only when demo mode is enabled, and are zero price. Existing paid plan rows are never overwritten by the seeder.

## Safe test-payment mode

Set `SKOPIA_BILLING_DEMO_ENABLED=true` **only on an isolated test/demo environment**, then start the application with its normal persistent database. Browse `/plans`, sign in as a registered viewer, choose a monthly or yearly demo pass, and press **Activate demo pass**. The API inserts an active subscription and one immutable payment row with `amount=0.00`, `payMethod=DEMO_NO_CHARGE`, and `payStatus=SIMULATED`; no card number, CVV, real money, gateway, or automatic renewal is involved. The client rejects card entry, and the server rejects unknown checkout fields. One active pass per viewer is enforced. Cancel on `/subscription` to immediately revoke access; the payment history remains.

**Do not enable demo mode as a real payment system.** It grants premium access at no charge. For real charges, integrate a compliant payment provider with verified server-side webhooks; this repository does not process payments.

## Verification

Run `mvn clean package` and `npm test` under `frontend/`. The H2 integration suite checks checkout ownership, rejection of card fields, expired/suspended access, persistence mappings, media Range access and cancellation revocation. The Postman collection in `postman/Skopia-Billing-Video.postman_collection.json` covers the demo API. Test against a separate database before any production merge; do not connect smoke tests to the live database.

Externally hosted video URLs cannot be protected after their direct URL becomes known. For protected premium playback, upload the video to Skopia rather than linking an external file.
