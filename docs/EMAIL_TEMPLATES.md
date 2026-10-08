# Branded transactional emails

The user's supplied dark Skopia HTML designs live in `src/main/resources/mail/`:

- `welcome.html`: sent after successful viewer or creator registration; account email plus app/login links.
- `password-reset.html`: one-hour reset link and copy/paste fallback.
- `payment-receipt.html`: refundable simulated LKR 500 demo-card payment receipt.
- `refund-status.html`: PENDING, APPROVED, REJECTED and CANCELLED status updates.

`SkopiaEmailTemplates` replaces whitelisted placeholders once, HTML-escapes all dynamic values and chooses refund badge colors/notes from server constants. Payment/refund links point to `/billing`. The existing logo is served at `/skopia-logo.png`. Small-screen CSS improves spacing, wraps long values and stacks detail cells without changing the desktop design.

## Configuration

`skopia.mail.public-origin` (example environment mapping: `SKOPIA_MAIL_PUBLIC_ORIGIN`) defaults to `https://skopia.randillasith.me`. Use a canonical HTTPS origin without path, query, fragment or trailing slash. It controls receipt/refund links, logo and footer.

Password reset still uses the separately validated `skopia.password-reset.public-origin`. Its entire email, including logo/footer, uses that canonical origin. Reset links retain `/reset/confirm#token=...`; no reset token is stored in the mail outbox or added to logs.

## Delivery and compatibility

The configured dedicated mail sender sends UTF-8 HTML plus the existing plain-text alternative. SMTP settings, recipients, claim leases, deduplication and bounded retry logic are unchanged. Rendering billing HTML at dispatch from whitelisted fields in immutable plain-text snapshots avoids a database/schema migration. Missing/incomplete legacy snapshots and legacy no-charge/complimentary receipts retain their original plain-text delivery rather than being mislabeled as LKR 500 payments. Refund reason/decision free text stays out of both alternatives.

Do not change snapshot headings/field names in `BillingMailService` without updating the renderer and integration tests. These form the existing outbox presentation contract. Tests cover MIME alternatives, escaping, all refund states, reset single use/expiry and token privacy, delivery failure/retry and unmodified legacy mail behavior.

Browser screenshots verify layout only; they are not proof of Gmail/Outlook rendering or live inbox delivery. Testing real clients or enabling a changed mail service requires a separately authorized deployment/test-send.

## Verification

```sh
./mvnw -B clean package
./mvnw -B -DskipFrontend=true -Dtest=SkopiaEmailTemplatesTest,BillingEmailTest,PasswordResetIntegrationTest,PasswordResetInvalidOriginTest test
```

To export **synthetic preview fixtures only** with the actual renderer, explicitly add `-Dskopia.email.preview-dir=/absolute/scratch/path` to Maven. The generated reset URL uses an inert synthetic token on a reserved `.test` origin. Never export real reset messages for screenshots.
