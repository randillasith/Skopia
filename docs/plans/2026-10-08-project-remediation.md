# Skopia Audit Remediation Implementation Plan

> **For Hermes:** Use subagent-driven-development, then independent specification and quality review before integration.

**Goal:** Remediate each confirmed issue from the October 8 project audit without conflating the explicitly simulated checkout with real payments.

**Architecture:** Base all changes on `origin/main` at `93cece4` in isolated worktrees. Integrate reviewed source/test diffs in `feature/skopia-audit-remediation-20261008`. No worker commits, pushes, production database writes, or deployments. Keep production operations behind backup, access-continuity, branch-protection, and public verification gates.

**Tech Stack:** Java 17/Spring Boot 3, MariaDB, React/TypeScript/Vitest/Vite, GitHub Actions.

---

## Preflight gates

- Verify HEAD/main/live SHA and PR checks; never edit `/opt/skopia/source` by hand.
- Production containment completed with user approval and private backup at `/opt/skopia/backups/seeded-staff-disable-20261008T065808Z`: four seeded privileged identities were deactivated, `prod` profile enabled, and the inactive `admin` handle reserved. No active nonseed administrator existed beforehand, so admin-console access is temporarily unavailable. This PR does not create a replacement admin or deploy the code fix; secure administrator recovery remains a separate gated operation.
- No real merchant/payment processor is configured and the user explicitly chose a simulation. Retain the zero-money disclaimer and make non-payment entitlement unmistakable. Real payments cannot be implemented without merchant/provider decisions and credentials; never collect card numbers, expiry or CVV.

### Task 1: Remove privilege-by-username and default-open API

**Files:** `src/main/java/org/gp14/skopia/security/BearerTokenFilter.java`, `config/SecurityConfig.java`; add/update Spring security integration tests.

1. RED: a newly registered/renamed registered viewer with handle `admin` must get 403 for `/api/admin/**` and `/api/billing/admin/**`, while an actual Administrator succeeds. A previously unlisted `/api/**` path must not be publicly callable.
2. GREEN: derive role solely from persisted type/role rows; remove username special case. Explicitly permit required public endpoints, deny unmatched API paths; audit actual route inventory to preserve intended public functionality.
3. Run focused security tests, then full backend tests. No production endpoint exploitation.

### Task 2: Remove fixed-credential seeding from production-capable profiles

**Files:** `user/StaffSeedData.java`, `advertising/AdvertisingSeedData.java`, related tests and `application.properties.example` if config changes.

1. RED: no default/prod startup creates accounts with known development credentials; explicit test/dev fixtures remain possible only under a safe profile/property.
2. GREEN: restrict fixtures to explicit `dev` and never use a fixed credential for a deployed environment. Keep intentional test fixture setup isolated in tests.
3. Run startup tests for default/prod/dev as relevant. Existing live accounts require separate protected rotation/disable plan; code alone will not revoke them.

### Task 3: Media revocation, file lifecycle, view integrity, search filters and badges

**Files:** `video/VideoAccessService.java`, `UploadedMediaController.java`, `VideoService.java`, `repository/VideoRepository.java`, user/profile badge DTO mappings; focused tests.

1. RED: a deactivated creator cannot play/see via an already signed private upload URL; failed upload leaves no orphan; video deletion removes only its owned files after successful transaction; repeated public view POSTs cannot inflate counts; `scope=mine` respects requested search/category/tier filters; badges agree with subscription-derived entitlement.
2. GREEN: revalidate user status on signed path, transaction-aware file cleanup, bounded view counting, parenthesized JPQL/criteria, derived premium flag. Preserve public free-video behavior and signed Range semantics.
3. Run focused tests and full backend suite; isolated MariaDB + packaged Range smoke where feasible.

### Task 4: Real channel creation rather than success-only UI

**Files:** `frontend/src/routes/studio.tsx`, auth/user/channel API and model as appropriate, routing/session integration, tests.

1. RED: viewer submits a channel, reloads, and only after backend success becomes a creator with persisted channel; duplicate handle/invalid name fails; failed request never shows success; other users cannot edit it.
2. GREEN: server-backed creator setup consistent with JOINED user inheritance; prevent role spoofing and duplicate conversion. If safe conversion cannot be completed without migration, remove false success and present truthful unavailable state instead of fabricating a channel.
3. Test API and route integration, then full frontend/backend suites.

### Task 5: Frontend account isolation, captions, keyboard and shared components

**Files:** `frontend/src/lib/library.tsx`, `components/player.tsx`, `components/primitives.tsx`, `components/search.tsx`, relevant tests.

1. RED: account switch cannot show previous account's playlists/follows/queue/searches/downloads; caption control shows no fabricated line; seek supports arrows/Home/End and window shortcuts ignore focused controls; dialogs focus/restore focus and tabs provide keyboard navigation; simultaneous SearchBoxes have unique ARIA IDs.
2. GREEN: per-account storage or full reset, real track only when source exists (otherwise disable captions), keyboard behavior and tests; use route lazy-loading for large routes only after verifying build/UX.
3. Run Vitest, lint, build and browser accessibility smoke.

### Task 6: Dependency, schema, CI and deployment safeguards

**Files:** `frontend/package-lock.json`, `.github/workflows/deploy-main.yml`, `schema.sql`/migrations docs/tests, `/opt/skopia/deploy-main.sh` only via a separately backed-up operational change.

1. Update `source-map-js` to a patched compatible release via lockfile, then run `npm audit --omit=dev`, tests/build.
2. Align schema documentation with executed migrations; run upgrade on throwaway MariaDB, not live database.
3. Require build and security checks in GitHub branch protection only after their names/stability are verified; keep CODEOWNERS/review workable and do not silently bypass protection.
4. For deploy script, back up DB/uploads/env/JAR before migrations, verify a meaningful `/api/health` response, and test rollback in isolation. No deployment script change on the live host without its own backup and test.

## Integration/verification gates

- Inspect every worker diff and run independent spec and quality reviews; reconcile overlapping files deliberately.
- Run full backend tests, frontend tests/lint/build, package and compare JAR frontend asset hash. Run isolated persistent MariaDB HTTP smoke (card/bank simulation, video Range and restart).
- `git diff --check`, staged scope/secret scan, push feature branch, verify remote SHA, open PR and wait for CI. Do not merge to production without satisfying protected branch policy; admin bypass needs separately explicit authorization.
- Production remediation requires verified DB/env/JAR/uploads backup, safe credential rotation that preserves sole admin access, controlled Skopia-only restart, and external URL/status/permission checks. Report any blocked parts instead of claiming completion.
