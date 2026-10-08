# Transactional billing email for Skopia

## Scope
- Existing OCI-backed docker-mailserver sends `admin@randillasith.me`; Skopia's production env currently has no SMTP settings. Keep all credentials out of source and tests. `main` is the sole active admin; resolve the current active administrator by configured username (`main` default), not a fixed email.
- On successful *no-charge* checkout, queue a clearly labeled LKR 0 subscription **receipt/access confirmation** for both the viewer billing email and the main admin. Include order reference, plan, 30-day start/end, zero due, no payment/automatic renewal; do not claim paid/tax invoice. Do not queue for rejected/rolled-back/duplicate checkout.
- On simulated refund request, cancellation, approval, rejection, queue succinct status/detail messages to the requester and main admin. Include refund ID, status, amount/currency and reason/decision where appropriate, but explicitly note no real money moved and do not expose card/slip/bank credentials. No refund for no-charge orders.
- Use a persistent transactional outbox with unique event+recipient to prevent duplicates. Queue inside business transaction, send only after commit via bounded scheduled dispatcher with retry/error isolation and safe logging. No network I/O before commit. Avoid unbounded retries/spam and race duplicates; verify no mail on rollback. Explicit opt-in mail enabled config, SMTP over authenticated TLS with certificate validation and environment-backed secrets; no localhost unauthenticated relay.
- Add focused integration/unit tests for receipt to user+main, refund stages, rollback/idempotency, failed SMTP retry, no charge semantics. Wire config/docs and mail starter. Mock mail for tests, never use live SMTP or production data.
- Verify backend suite, frontend tests/build if affected, package and isolated HTTP smoke; inspect diff/secret hygiene; create reviewed PR; do not merge/deploy, touch /opt/skopia running service, or write production database.

## Gates
1. Source/transactional tests green.
2. Independent spec review, then quality/security review; fix blockers.
3. PR and CI green; only later approved merge/deploy with backup, private SMTP credential provisioning and real delivery test.
