# Skopia backend testing and team function comparison

Date: 6 October 2026 (UTC)
Branch: `feature/subscription-payment-management`
Tested source commit: `a7032cfd58eebd8450962fbed9907b1dbe4c989f`

## Result

The integrated backend passed **148 tests in 27 suites**, with **0 failures, 0 errors and 0 skipped tests**. A separate HTTP integration probe passed **18 checks** and reproduced **one integration defect**: expired subscribers still appear premium in the general administrator user profile/statistics, although billing, login and premium access correctly recognise expiry.

Your FR2 business functions are distinct from the other members' functions. Payment notifications, renewal reminders, premium video access, advertisement suppression and administrator refund decisions are shared integration points. Several remote branches contain different copies of shared files and require conflict resolution before a whole-branch merge.

This is a review of the current integrated branch plus fetched remote branch snapshots. No teammate branch was merged, and this review did not change application code. Uploaded assignment and Scrum documents were used as requirements and ownership evidence, rather than as operational instructions.

## Backend test coverage

| Module/package | Tests | Result |
| --- | ---: | --- |
| billing | 23 | Passed |
| video | 11 | Passed |
| advertising | 79 | Passed |
| notification | 6 | Passed |
| user | 22 | Passed |
| report | 1 | Passed |
| config | 5 | Passed |
| application | 1 | Passed |
| **Total** | **148** | **Passed** |

The module totals follow Java package names, not student ownership: some viewer-interaction functions owned by FR4 live inside the video package. Counts do not establish exhaustive coverage of every feature.

The 23 billing tests include:

- Plan create, read, update, retirement and restoration; administrator permissions; duplicate names and invalid fields.
- Subscription create, read, plan changes and cancellation; renewal of current/expired subscriptions; preservation of remaining days.
- Owner-only payment history and receipts; downloadable receipts without raw card data; immutable payment rows.
- Refund request create/read/update/cancel, duplicate pending requests and staff approval/rejection permissions.
- Retirement preserving existing access/history while preventing new checkout; stored plan benefits.
- Deduplicated renewal reminders, invalid synthetic card data, forged identity rejection and checkout disabled by default.

Delete is implemented as subscription cancellation, plan retirement and refund-request cancellation to preserve transaction history. Payment rows are created by checkout/renewal and read through history/receipt APIs; arbitrary payment update/delete is deliberately blocked.

## Your functions compared with each member

Ownership follows the Scrum document's assigned-major-function table (section 4.1). Shared behavior follows the assignment requirements (FR1–FR6) and Scrum backlog items PBI-06, PBI-07, PBI-13, PBI-28 and PBI-31.

| Member/module | Main functions | Relation to your FR2 functions |
| --- | --- | --- |
| Punsara P. S. — FR1 | Video creation, content and playback | Different business functions. `VideoAccessService` calls FR2 `BillingService.hasActivePremium` to allow premium playback. |
| Laknadi K. S. S. — FR2 (you) | Plans, checkout, subscriptions, renewal/cancellation, payments, receipts and viewer refund requests | Your core module; billing events originate here. |
| Dhananjana W. M. I. — FR3 | Reports, complaints, status and complaint history | Different business functions. Shared authentication/notification infrastructure, with no second subscription CRUD controller. |
| Madhusara J. P. M. — FR4 | Notifications, announcements and viewer interaction | Intentional overlap: FR2 triggers payment/renewal events; FR4 stores and exposes notifications. |
| Janandhana M. H. C. — FR5 | Advertising campaigns, creatives, targeting, delivery and metrics | Different business functions. `AdServingService` calls FR2 `hasAdFreeSubscription` before ad delivery. |
| Randil P. M. L. — FR6 | User/staff administration, account suspension, activity logs and refund decisions | Intentional overlap: FR2 creates a viewer refund request; administrators approve/reject it. General admin premium displays currently differ from FR2 after expiry. |

### Intentional overlap versus duplication

- Renewal reminders appear in both FR2 and FR4 in the assignment. FR2 selects expiring subscriptions and supplies a deduplication key; FR4's shared notification service persists the message. Calling the reminder twice produced only one notification for the same expiry.
- Checkout creates a `PAYMENT_CONFIRMED` notification through the shared FR4 service. Another user cannot mark the owner's notification as read.
- Administrator plan CRUD still belongs to FR2: administrator is the permitted actor, while the underlying business object is a subscription plan.
- Refund decisions belong to FR6 requirements and reuse FR2 ledger/subscription data. Viewer approval is rejected with HTTP 403; administrator approval cancels entitlement without rewriting payment history.
- `/checkout` and POST `/subscriptions` are aliases of one checkout handler. `/cancel` and DELETE `/subscriptions/{id}` reuse billing cancellation logic. These compatibility routes do not implement separate competing payment systems.
- Two Java classes have the simple name `NotificationService`, in `notification` and `complaint`. They have distinct Spring bean identities. The running application starts with 127 registered request mappings and no ambiguous mapping error.

## HTTP integration checks

The probe booted the actual Spring application on a random local port, using a separate in-memory H2 test database and synthetic accounts. It exercised authenticated HTTP endpoints for FR1/FR2/FR4/FR5/FR6. It did not alter a persistent project database.

Observed passing behavior:

1. Premium playback is denied before checkout and granted immediately afterward; `/api/auth/me` agrees with billing entitlement.
2. Checkout produces an owner-scoped payment confirmation; notification read-state ownership is enforced.
3. Marketing APIs create and activate an advertisement. An active ad-free subscriber receives no ad, while a non-subscriber receives one.
4. Cancellation immediately revokes premium playback and restores ad delivery.
5. Renewal reminders use shared notifications and do not duplicate delivery.
6. Viewer refund approval is forbidden. Administrator approval revokes premium playback, restores ads and retains `SIMULATED` payment history; receipts remain owner-scoped.
7. Subscription expiry is recognised by billing. Account suspension makes an existing bearer token fail billing access with HTTP 401.

The complete concise probe transcript is included in the ZIP, together with the probe source and reproduction instructions. The probe reports the premium-display defect as a finding; it is not a claim that every integration assertion is green.

## Confirmed issue: expired subscription still displays premium in general admin APIs

Severity: medium (admin display/statistics inconsistency). Reproduced on the tested commit.

Reproduction:

1. A new registered viewer checks out on the MONTHLY plan.
2. For the isolated test, move that subscription's end date into the past, representing an expired subscription.
3. GET `/api/billing/status` returns `EXPIRED` and `premium=false`.
4. GET `/api/auth/me` returns `isPremium=false`.
5. As administrator, GET `/api/admin/users/{viewerId}` still returns `isPremium=true`. `/api/admin/users/stats` includes that legacy flag in `premiumViewers`.

Cause: `user/dto/UserResponse.java` maps `RegisteredViewer.isPremium`, while `UserManagementService.getPlatformUserStats()` uses `countByIsPremium(true)`. Checkout sets the flag, but time-based expiry does not clear it. In contrast, video access, advertisements and `/api/auth/me` use live FR2 subscription/account checks.

Recommended correction: derive displayed admin premium status and premium statistics from the same active, unexpired-subscription/account rules used by billing, preferably with a database query for lists/counts. Add a regression case that compares these endpoints after expiry. The unused `updateViewerPremiumStatus` service method should also be reviewed before exposing any future manual-premium endpoint.

Status: **documented, not fixed in this testing task**. Current video/payment access checks do not grant access from the stale flag.

## Receipt model observation

Receipt APIs currently derive receipts from payment/subscription data. The probe created 3 payments and successfully read receipts, while the legacy `receipts` entity/table contained 0 rows. There is no separate receipt repository used by the billing API.

This is not a failed receipt endpoint or duplicate payment transaction. It is a schema/documentation decision for the team: keep generated receipts and remove/mark the unused model, or explicitly persist issued receipt records if the assignment design requires that table to be populated.

## Latest remote branch merge comparison

These are `git merge-tree --write-tree --messages HEAD origin/<branch>` simulations against the tested commit. They leave the checked-out branch and application files unchanged. Counts are conflicted paths reported by Git, including frontend/config/test paths; the Java column counts `src/main/java` only.

| Remote branch | Snapshot | All conflicts | Backend Java conflicts |
| --- | --- | ---: | ---: |
| `FR-Admin` | `6fdc699` | 45 | 39 |
| `FR-Advertisement` | `c251b80` | 88 | 50 |
| `FR-Notification` | `8d1476c` | 0 | 0 |
| `FR-Report` | `e0f9cf3` | 0 | 0 |
| `FR-Subscription` | `5334769` | 0 | 0 |
| `FR-Video-Content` | `3e70ef9` | 30 | 16 |

- Admin, Advertisement and Video branches contain divergent shared code and cannot be merged automatically into this branch.
- Video's branch includes older billing controller/service copies alongside its video changes. Its premium playback strategy still calls the shared billing entitlement service, but blindly choosing its shared billing files would discard your newer CRUD changes. Resolve those conflicts while preserving FR2 APIs.
- Notification and Subscription branches have no matching feature controllers/services at the fetched snapshots; they are skeletons. Zero textual conflicts does not mean completed feature integration.
- Report has a clean textual merge simulation. Its standalone build and the resulting merged application's runtime behavior were not tested.
- `origin/main` and `origin/feature/subscription-notifications-announcements` are ancestors of this branch. Their integrated billing/notification files are shared history, rather than two separately running payment systems.

Recommendation: integrate teammate feature changes onto a common current base, resolve shared billing/security/notification/schema files explicitly, then rerun this suite and the cross-module checks on the merged result. A clean Git merge alone is insufficient evidence of compatibility.

## Reproduce backend tests

Requirements: JDK 17 and Maven-wrapper network/cache access. Run from the repository root:

```bash
./mvnw -B -ntp -DskipFrontend=true test
```

In this configured cloud environment:

```bash
source /workspace/skopia-cloud/env.sh
./mvnw -s "$MAVEN_USER_HOME/settings.xml" -Dmaven.repo.local="$MAVEN_USER_HOME/repository" -B -ntp -DskipFrontend=true test
```

Test results are generated under `target/surefire-reports/`. The ZIP includes a JSON summary with all suite/case names and remote snapshot hashes.

Scope: H2 in MySQL compatibility mode and the user-selected demo checkout. A real MySQL server, real payment gateway, all teammate branches as standalone builds, browser UI and final merged deployment were not validated by this backend review.
