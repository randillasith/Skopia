# Subscription, Refund, Notification, and Announcement Backend Implementation Plan

> **For Hermes:** Implement task-by-task with failing integration/service tests before production changes.

**Goal:** Complete Skopia's demo subscription switching, simulated refunds, durable notifications, announcement administration, and the matching user/admin React UI without replacing unrelated modules or deployment state.

**Architecture:** Extend the existing Spring Boot/JPA modules with ownership-scoped services and controllers. Keep payment rows immutable, serialize plan changes by pessimistically locking the viewer, store notification dedupe keys under a per-user unique constraint, and keep video plus notification fanout in one transaction. Use explicit state machines for refunds and announcements and an idempotent MariaDB compatibility migration for existing installations.

**Tech Stack:** Java 17, Spring Boot 3.4, Spring Security, Spring Data JPA, H2 integration tests, MariaDB/MySQL DDL.

---

### Task 1: Billing and refund behavior
- Add failing MockMvc/service tests for atomic MONTHLY/YEARLY replacement, same-plan conflict, entitlement revocation, payment immutability, refund ownership/IDOR, one pending request, admin roles, terminal transitions, audit, and enriched admin DTOs.
- Extend billing entities/repositories/DTOs/services/controllers with the minimum state and endpoints needed by those tests.
- Run focused billing tests until green.

### Task 2: Durable notifications
- Add failing tests for authenticated list/count, ownership-safe mark-one, mark-all, video creator exclusion, active-viewer audience, dedupe, and rollback/no-notice behavior.
- Implement notification fields, repository methods, service/controller, and transactional video-create fanout.
- Run notification and video-focused tests until green.

### Task 3: Announcements
- Add failing tests for admin-only draft/create/edit/publish/archive transitions and ALL/VIEWERS/CREATORS audience filtering.
- Implement announcement state fields, repository queries, service/controller, validation, and authenticated published listing without notification fanout.
- Run announcement tests until green.

### Task 4: Schema and documentation
- Update `schema.sql` for fresh databases.
- Extend the runtime migration with idempotent, non-destructive MariaDB column/index/FK changes and legacy data backfills.
- Document demo/no-money semantics, refund effects, announcement audiences, notification fanout, and that “nursery data” means necessary seed/migration data rather than disposable production records.

### Task 5: Verification
- Run focused backend tests, then the full backend suite with the frontend Maven lifecycle skipped.
- Inspect `git diff`, verify no frontend/deployment/credential changes, and report exact changed paths and test totals.
