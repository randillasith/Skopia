# Demo subscriptions, simulated refunds, notifications, and announcements

Skopia has **free videos** (public playback) and **premium videos** (requires an active, unexpired subscription). The subscription table is the authority for entitlement. The legacy `registered_viewers.is_premium` field is synchronized for compatible screens, but it does not grant playback by itself.

## Demo subscription and payment semantics

Set `SKOPIA_BILLING_DEMO_ENABLED=true` only in an isolated demo/test environment. The existing checkout contract remains synthetic-card-only: `planName`, the documented accepted test card number, `MM/YY` expiry, and cardholder name. Validation is local and no gateway is contacted.

MONTHLY and YEARLY may replace one another immediately. The viewer row is pessimistically locked, every current active subscription is cancelled, and a new active target subscription plus a new immutable payment ledger row are committed in one transaction. Selecting the already-active plan is rejected. Every demo payment has `amount=0.00`, `payStatus=SIMULATED`, a generated test reference, and safe display metadata such as brand/last four digits. Raw card numbers, expiry values, cardholder names, and security codes are never persisted or returned. Cancellation and expiry revoke authoritative entitlement; historical subscriptions and payments remain.

## Simulated refunds

Authenticated viewers may request a refund only for their own payment. Reasons are trimmed and bounded, and a payment may have only one PENDING request at a time. The payment row is locked while this rule is checked. Viewers can list only their own requests.

Administrators can list all requests and move a PENDING request once to APPROVED or REJECTED, recording processor identity, decision time, and an optional bounded note. The transition is audited. Approval immediately cancels the associated subscription and synchronizes the legacy premium flag, but it does not transfer money and never changes or deletes the immutable payment. A simulated refund is an entitlement/admin workflow, not a financial settlement.

## Durable notifications

Notifications are stored per user with title, body, type, link, creation time, dedupe key, and read time. `(user_id, dedupe_key)` is unique. Authenticated users can list their own notifications, count unread items, mark one owned notification, or mark all of their notifications read; cross-user IDs return no data.

A successfully committed PUBLISHED video creation creates a notification for every active viewer except the creator. There is no follow/subscription-to-creator persistence in this codebase, so “all active viewers” is the intentional audience. Video and notification inserts share the same transaction: failed video creation leaves no notifications, and retries are deduplicated.

## Announcements

Administrators create and edit DRAFT announcements, publish them, and archive them. Only PUBLISHED announcements are visible through the authenticated user endpoint. Audiences are:

- `ALL`: every authenticated user.
- `VIEWERS`: registered viewers, excluding content creators.
- `CREATORS`: content creators.

Announcements are queried at read time and are not copied into per-user notification rows.

## Schema and migration data

`schema.sql` describes a fresh database. Runtime MariaDB/MySQL compatibility migrations are additive and idempotent: they add missing columns/indexes, backfill legacy rows, and broaden the subscription owner foreign key from registered viewers to viewers so creator passes remain valid. They do not truncate tables or discard payments, subscriptions, refunds, notifications, or announcements.

Where project notes refer to **“nursery data,”** interpret that as **necessary seed/migration data** required for the demo catalog and compatibility—not as permission to delete existing user or production data.

## Verification

Run the backend suite against the isolated H2 `test` profile. Before any production integration, also exercise the packaged application against a throwaway persistent MariaDB database. Never run demo checkout/refund verification against production data.
