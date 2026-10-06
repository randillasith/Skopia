# FR2: Subscription and Payment Management

Branch: `feature/subscription-payment-management`.

This Java/Spring Boot module implements FR2 from the assignment requirements and
Scrum stories PBI-06 (checkout and receipt), PBI-07 (renew/change/cancel), PBI-13
(billing history), and PBI-28 (administrator plan management). It uses the existing
JPA entities, MySQL configuration, signed bearer authentication, and frontend API
contracts. Refund decisions remain administrator-only, consistent with FR6/PBI-31.

Payment processing uses the project's existing **demo checkout**, as selected for
this assignment. It does not contact a payment gateway, charge money, or renew
automatically. Only active plans priced at `0.00` can be purchased in demo mode.
Administrators can maintain other prices, but those plans cannot be checked out
without a future real payment integration. No currency or gateway provider is
invented here.

## Run locally

Requirements: a full JDK 17+, the checked-in Maven wrapper, and Node 24 LTS.
From the repository root:

```bash
./mvnw -B clean package
./mvnw -DskipFrontend=true \
  -Dspring-boot.run.profiles=h2 \
  -Dspring-boot.run.useTestClasspath=true \
  -Dspring-boot.run.arguments=--skopia.billing.demo-enabled=true \
  spring-boot:run
```

The backend runs on port **8081**. H2 is test-scoped, so `useTestClasspath` is
needed when running the H2 development profile. Its database is in memory and
resets on restart. The packaged JAR defaults to MySQL; configure `SKOPIA_DB_URL`,
`SKOPIA_DB_USER`, `SKOPIA_DB_PASSWORD`, and `SKOPIA_AUTH_SECRET` for that mode.
Keep real values outside the repository. Never enable demo billing on production
data.

In this Codex cloud environment, first source `/workspace/skopia-cloud/env.sh`
and add `-s "$MAVEN_USER_HOME/settings.xml"` and
`-Dmaven.repo.local="$MAVEN_USER_HOME/repository"` to the Maven commands. These
activate the full JDK and cloud proxy configuration without disabling TLS.

For frontend development, run `npm ci && npm run dev` from `frontend/`. Vite
serves port **5175** and proxies API requests to **8081**. The existing screens
and checkout endpoints remain compatible. This branch adds Java APIs; it does
not add frontend controls for administrator plan editing or custom plan checkout.
The Stitch design page required access and could not be read during implementation.

## Authentication and CRUD endpoints

All paths below start with `/api/billing`. Send `Authorization: Bearer <token>`
from `/api/auth/login` or `/api/auth/register`. User identity comes from the
verified token, never from `X-User-Id` or a body parameter. A username such as
`admin` does not grant an administrator role.

| Resource | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| Plans (administrator) | `POST /admin/plans` | `GET /admin/plans`, `GET /admin/plans/{id}` | `PUT /admin/plans/{id}` | `DELETE /admin/plans/{id}` |
| Own subscriptions | `POST /subscriptions` | `GET /subscriptions`, `GET /subscriptions/{id}` | `PUT /subscriptions/{id}` (change plan) | `DELETE /subscriptions/{id}` (cancel) |
| Own refund requests | `POST /payments/{id}/refunds` | `GET /refunds`, `GET /refunds/{id}` | `PUT /refunds/{id}` | `DELETE /refunds/{id}` (cancel pending request) |

Additional endpoints:

| Method and path | Behavior |
| --- | --- |
| `GET /plans` | Public active plan catalog; includes the `demoEnabled` flag |
| `GET /status` | Current signed-in viewer's premium status |
| `POST /subscriptions/{id}/renew` | Renew the latest active/expired subscription with synthetic payment details |
| `GET /payments` | Own immutable payment history |
| `GET /payments/{id}` | Own payment details |
| `GET /payments/{id}/receipt` | Own structured receipt |
| `GET /payments/{id}/receipt/download` | Downloadable plain-text receipt, clearly marked as demo |
| `GET /admin/users` | Administrator subscription overview |
| `GET /admin/refunds` | Administrator refund review list |
| `POST /admin/refunds/{id}/decision` | Finalize PENDING as APPROVED/REJECTED |

Existing `/checkout`, `/change-plan`, `/cancel`, `/refunds`, and administrator
approve/reject aliases are retained for the current React UI.

### Plan create/update example

```json
{
  "planName": "WEEKLY",
  "durationDays": 7,
  "price": 0.00,
  "benefit": "Premium video access",
  "adFree": true,
  "active": true
}
```

Names are normalized to uppercase and must be unique; duration is 1–3650 days,
price is nonnegative with at most two decimal places, and benefit text is at most
2000 characters. Missing required fields return 400. Deleting retires a plan
(`active=false`) and removes it from the public catalog. Administrator reads
retain retired plans, and PUT with `active=true` restores them. Existing paid
periods and receipts remain accessible. A used plan cannot be renamed; create
a new plan instead. Benefit changes apply to current entitlement checks, while
duration and price changes affect future purchases.

### Subscription create example

```json
{
  "planName": "MONTHLY",
  "cardNumber": "4216000000000002",
  "expiry": "12/99",
  "cardholderName": "Demo Viewer"
}
```

Renewal takes the same three synthetic payment fields without `planName`.
PUT a subscription with `{"planName":"YEARLY"}` to change plan.
POST/PUT a refund with `{"reason":"Please cancel this demo purchase"}`.

Create returns 201; reads and updates return 200; plan/refund deletion returns
204; subscription deletion returns the cancelled subscription with 200. Bad
fields return 400, missing authentication 401, insufficient role 403, missing
or another user's records 404, and invalid lifecycle transitions/duplicates 409.
Demo checkout/renew/change-plan returns 503 when demo billing is disabled.

## Lifecycle, receipts, and audit history

Plan changes immediately cancel the old active subscription and create a new
subscription/payment in one transaction. Renewal creates a new subscription and
payment, extending the previous expiry by the plan duration; expired subscriptions
restart from the current time. The old subscription is marked RENEWED or EXPIRED.
Only the latest active/expired subscription may be renewed; repeating a renewal
against the old ID is rejected. Deleting an active subscription cancels access
and is idempotent. Viewers, including content creators, see only their own records.

Payments are immutable ledger entries: checkout/renewal creates them and history
and receipts read them. There are intentionally no endpoints that overwrite or
delete completed payments. Corrections use refund requests. Only PENDING refund
requests may be edited or cancelled; cancelled/finalized requests remain in history.
Administrator approval revokes the related subscription but does not transfer
money or mutate the payment ledger. Subscription and plan DELETE operations
therefore preserve the traceable transactions required by FR2.

Receipts include reference, status, amount, plan, date, account, and subscription
period. Raw card number, expiry, and cardholder name are never stored or returned;
only safe brand/last-four metadata is retained. Simulated payments have amount
`0.00`, status `SIMULATED`, and a generated `TEST-` reference.

Successful checkout and renewal create durable in-app payment confirmations.
The daily renewal reminder job notifies active accounts with subscriptions expiring
in the next three days. Reminders are deduplicated per subscription/expiry and
skip cancelled, expired, future-starting, and suspended accounts. The cron can be
configured with `skopia.billing.renewal-reminder-cron`; `-` disables it in tests.
These are in-app notifications, not email delivery or automatic billing.

## Database and verification

`subscription_plans` gains `ad_free` and `active`. Hibernate's existing
`ddl-auto=update` supplies the additive development migration; `schema.sql` includes
the fields for fresh databases. Null legacy `ad_free` values preserve the previous
MONTHLY/YEARLY benefit rules. No existing ledger data is deleted.

```bash
./mvnw -B -DskipFrontend=true -Dtest='org.gp14.skopia.billing.*Test' test
./mvnw -B clean package
npm --prefix frontend test
npm --prefix frontend run lint
```

`SubscriptionPaymentCrudApiTest` covers plan CRUD, validation, retirement/restoration,
ownership, subscription changes/cancellation/renewal, receipts, refund CRUD/finalization,
reminder deduplication, stored access benefits, demo price restrictions, and forged
authentication. Existing billing tests cover demo gating and immutable payments.

Validation on this branch: the full Maven package build passed all 148 backend
tests with no failures, errors, or skips; all 36 frontend tests passed. Lint
completed with existing warnings and no errors. All 26 requests from the Postman
collection were also exercised over HTTP against the restarted H2 backend,
including receipt download and refund approval. The built React page/asset and
Vite API proxy passed smoke checks. MySQL migration and real gateway settlement
were not tested by these H2/demo checks.

Import `postman/Skopia-Subscription-Payment-CRUD.postman_collection.json` and set
`baseUrl`, `viewerToken`, and `adminToken`. IDs are captured from successful
responses for later requests. The collection includes a custom plan for CRUD
demonstration and owner-scoped checkout/renewal/receipt/refund flows.

To unblock compilation, this branch also removes the duplicate
`ComplaintRepository.findByReportId` declaration, repairs an obsolete notification
adapter call, and removes a nonexistent duplicate takedown-notification call:
`VideoService` already performs that notification. No complaint feature is replaced.
Existing report/complaint checks also enforce staff-only access and use the existing
`VIDEO_TAKEN_DOWN` notification contract, as required by the repository's tests.
