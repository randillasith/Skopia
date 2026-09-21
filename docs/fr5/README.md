# FR5 — Advertisement Management

Everything an advertising officer does, and everything a viewer sees as a result:
campaigns, creative, targeting, delivery, expiry and performance.

- **Backend** — `src/main/java/org/gp14/skopia/advertising/`
- **Repositories** — `src/main/java/org/gp14/skopia/repository/Ad*.java`
- **Entities** — `src/main/java/org/gp14/skopia/model/advertisement/`
- **Frontend** — `frontend/src/routes/campaigns.tsx`, `frontend/src/components/AdSlot.tsx`,
  `frontend/src/lib/ads.ts`
- **Tests** — `src/test/java/org/gp14/skopia/advertising/` (58 tests)

---

## Running it

The API and the UI are one application; `mvnw package` builds the Vite bundle into
the jar.

```bash
# Against MySQL. Set the credentials first — nothing real is committed.
export SKOPIA_DB_PASSWORD=…
./mvnw spring-boot:run

# Or without setting MySQL up at all. In-memory, gone when you stop it.
./mvnw spring-boot:run -Dspring-boot.run.profiles=h2
```

Then open <http://localhost:8080/campaigns>, signed in as a marketing officer.

For frontend work, `npm run dev` in `frontend/` serves the UI on 5175 and proxies
`/api` and `/uploads` to 8080.

> **Build the frontend.** `-DskipFrontend=true` skips copying the Vite bundle, and
> `src/main/resources/static/` (FR-Admin's separate plain-HTML UI) then wins at
> `/`. A full `./mvnw package` copies the React bundle afterwards and it serves
> correctly. See *Known limitations*.

### The initial database

`src/main/resources/schema.sql` is the EER diagram written as MySQL DDL, including
the four FR5 tables. Hibernate's `ddl-auto=update` derives the schema on its own,
so this file is not executed automatically — run it by hand against a fresh
database when you would rather own the schema than let Hibernate derive it.

On a database with no marketing officer and no catalogue, `AdvertisingSeedData`
creates one officer (`@m.madhusara`), six categories and six titles, so the
console is usable rather than empty. It writes nothing that already exists and is
disabled under the `prod` and `test` profiles.

---

## Data model

Four tables, all in `schema.sql`.

| Table | What it holds |
|---|---|
| `ad_campaigns` | The booking: advertiser, budget, window, status. Owns the schedule. |
| `advertisements` | One piece of creative inside a campaign, plus an on/off switch. |
| `ad_placements` | The targeting rule: this ad, in this slot, against this title **or** this category. |
| `ad_impressions` | The delivery log. One row per showing; a click is a column on it. |

Four columns are not on the EER diagram, and each earns its place:

- `ad_campaigns.advertiser` — the diagram assumed the officer's own department was
  the advertiser. The campaign list is unreadable without naming who a booking runs for.
- `advertisements.ad_status` — FR5 asks for Draft / Active / Inactive per
  advertisement; the diagram had status only at campaign level.
- `ad_impressions.clicked_at` — `was_clicked` alone gives a CTR but no click trend.
- `ad_impressions.video_id` — **the important one.** A category placement names no
  title, so without this, "which titles did this campaign run against?" can only be
  answered with "a category", which is the question rather than the answer.

### Two rules the schema enforces

- A placement targets **exactly one** of a title or a category
  (`ck_placement_one_target`). Both is ambiguous; neither targets the whole
  platform by accident.
- The same creative cannot fill the same slot on the same target twice
  (`uq_placement_video`, `uq_placement_category`) — that is a double billing.

---

## Status, and why there are two of them

```
DRAFT ──confirm──▶ SCHEDULED ──(start date)──▶ ACTIVE ──(end date)──▶ EXPIRED ──▶ ARCHIVED
                        └──────── pause ⇄ resume ────────┘
```

`campaign_status` is what the database stores. `effectiveStatus(now)` is what the
API returns and the screen shows. They differ between expiry sweeps, on purpose:

- A status a **person** chose — draft, paused, archived — is never overridden.
- Everything else is **derived from the dates**, so a campaign that ended overnight
  reads as expired on the very next request.

`AdCampaignService.list` therefore filters the derived status in Java rather than
pushing it into SQL — asking the database for `EXPIRED` would miss a campaign that
lapsed an hour ago and is still stored as `SCHEDULED`.

### Expiry does not depend on the sweep

`AdExpiryJob` (every 5 minutes, `skopia.ads.expiry.cron`) brings the stored column
into line with the calendar, in both directions. It is a **convenience, not the
safety net**: `AdPlacementRepository.findEligible` re-checks the dates on every
single request, so a failed or skipped sweep can leave a row looking out of date
but can never show an expired advertisement to a viewer. `AdServingServiceTest`
proves this with no sweep having run at all.

---

## API

Management endpoints identify their caller with the `X-User-Id` header. Serving
endpoints deliberately do not — viewers, including signed-out ones, call those.

### Session

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/advertising/session?handle=` | Resolves a handle to the `actorId` used below. 403 if that account may not manage advertising. |

### Campaigns

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/ad-campaigns?search=&status=` | Status filtered on the **derived** value. |
| `GET` | `/api/ad-campaigns/{id}` | |
| `POST` | `/api/ad-campaigns` | Creates a `DRAFT`. 400 if the end date does not fall after the start. |
| `PUT` | `/api/ad-campaigns/{id}` | Same window rule. 409 once archived. |
| `POST` | `/api/ad-campaigns/{id}/confirm` | 409 with no advertisement, or if the end date has passed. |
| `POST` | `/api/ad-campaigns/{id}/pause` · `/resume` · `/archive` | |
| `DELETE` | `/api/ad-campaigns/{id}` | Drafts only. Anything that ran is archived instead, so its delivery log keeps meaning something. |
| `POST` | `/api/ad-campaigns/sweep-expired` | Runs the expiry sweep now. |

### Advertisements and targeting

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/advertisements?campaignId=` | |
| `POST` · `PUT` | `/api/advertisements[/{id}]` | Cannot move between campaigns. |
| `POST` | `/api/advertisements/{id}/activate` | 409 with no target — it would never be delivered. |
| `POST` | `/api/advertisements/{id}/deactivate` | |
| `DELETE` | `/api/advertisements/{id}` | 409 once it has been shown. |
| `GET` · `POST` | `/api/advertisements/{id}/targets` | 400 for both-or-neither; 409 for a duplicate. |
| `DELETE` | `/api/advertisements/targets/{placementId}` | |
| `GET` | `/api/advertisements/target-options?search=` | Categories and titles in one call. |
| `POST` | `/api/advertisements/media` | `multipart/form-data`, field `file`. |

### Serving — open to viewers

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/ads/active?videoId=&slot=&viewerId=&device=&limit=` | Returns `[]` when nothing is booked. **Records the impression itself.** |
| `POST` | `/api/ads/impressions` | For a client rendering a placement it already held. |
| `GET` | `/api/ads/click/{impressionId}` | Logs the click, then 302s to the advertiser. Idempotent. |

### Performance

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/ad-campaigns/{id}/metrics?from=&to=` | Inclusive both ends; last 30 days by default. |
| `GET` | `/api/advertisements/{id}/metrics?from=&to=` | |
| `GET` | `/api/ad-campaigns/{id}/metrics.csv` · `/api/advertisements/{id}/metrics.csv` | |

### Errors

```jsonc
{ "message": "The end date must fall after the start date.", "at": "…" }
{ "message": "That form is not complete yet.", "fields": { "campaignName": "…" } }
```

`fields` lets a form put each message under the input that caused it rather than
dropping one banner at the top of the page.

---

## Serving, in order

1. `findEligible(videoId, categoryId, slot, now)` — one query, because eligibility
   depends on the campaign window, the campaign status, the advertisement switch
   and the placement window **at once**, and checking them in separate passes is
   how an expired advertisement slips through.
2. Group by `priority`, highest band first.
3. Shuffle within the band. Strict ordering would hand every impression to one
   advertiser for the whole booking; rotation spreads delivery without storing a
   cursor, which matters because serving is the one path that has to stay cheap.
4. De-duplicate **by advertisement** — a title targeted directly *and* through its
   category yields two eligible placements for one creative, and showing it twice
   in one break is something a viewer notices and an advertiser is billed for.
5. Record the impression, including the video it ran against.
6. Return a tracking URL, never the advertiser's own.

---

## Media upload

Stored under `skopia.ads.media.storage-dir` (default `uploads/ads/yyyy/MM/`) and
served from `/uploads/ads/**`. Accepts MP4, WebM, MOV, PNG, JPEG, WebP, GIF, up to
50 MB (`skopia.ads.media.max-bytes`).

Both the extension **and** the declared content type are checked, because either
alone is trivially wrong: a browser will send `application/octet-stream` for a good
MP4, and an attacker will rename a script to `.png`. The stored filename is a
generated UUID, so whatever the client called it cannot escape the directory or
collide — `../../etc/passwd.png` is just a name in the response.

---

## Access control

`AdvertisingAccess` lets through a **marketing officer** or an **administrator**,
and requires an `ACTIVE` account. Owning a campaign is narrower: `created_by`
points at `marketing_officers`, so an administrator can read every booking but
cannot hold one, and the API says exactly that rather than attributing the work to
whoever happens to be first in the table.

---

## Known limitations

These are real, and worth carrying into the next sprint rather than discovering.

1. **A handle is not proof of identity.** `/api/advertising/session` trusts the
   handle it is given, and every management endpoint trusts `X-User-Id`. That is
   not weaker than the rest of Skopia — `/api/auth/login` already issues a token
   nobody validates, and other controllers already trust caller-supplied ids — but
   it is not authentication. When real sessions land, this should read the
   authenticated principal, and `X-User-Id` should stop being trusted across the
   **whole** API, not only here.

2. **Two frontends claim `/`.** `frontend/` (React, this branch) and
   `src/main/resources/static/` (FR-Admin's plain HTML) both produce an
   `index.html`. A full `mvnw package` copies the React bundle last so it wins, but
   `-DskipFrontend=true` leaves the other one serving. The team should decide which
   is the product.

3. **The catalogue the UI renders is still placeholder data.**
   `frontend/src/lib/data.ts` holds titles with ids like `v-1041`, while serving
   works in real `videos.video_id`. `useBackendVideoId` bridges the two by matching
   on title, and should be deleted the moment browse and watch read the catalogue
   from the API.

4. **Metrics are computed from the raw log on every request.** At Skopia's scale
   that is the right trade, and it avoids a whole class of bug where a dashboard
   and its underlying rows disagree until someone re-runs a job. Every aggregate
   lives in `AdImpressionRepository`, so the day the log outgrows this, the change
   is to point those queries at a summary table and nothing above them moves.

5. **Budget is recorded, not enforced.** Delivery does not stop when spend reaches
   it, because there is no cost-per-impression anywhere in the documentation to
   spend against.

---

## Tests

```bash
./mvnw test -DskipFrontend=true -Dtest='org.gp14.skopia.advertising.*Test'
```

| Class | Covers |
|---|---|
| `AdCampaignServiceTest` | Window rule on create *and* edit, derived status, pause/resume, archive-not-delete, RBAC. |
| `AdServingServiceTest` | Targeting by title and category, de-duplication, slots, priority, **expiry with no sweep run**, impression and click logging. |
| `AdPlacementServiceTest` | Both-or-neither targets, duplicates, window clamping, target options. |
| `AdExpiryJobTest` | Both sweep directions, chosen statuses left alone, idempotence. |
| `AdMediaStorageServiceTest` | Accepted formats, extension/type mismatch, path traversal, size limits. |
| `AdAnalyticsServiceTest` | Windowing, inclusive ranges, daily series, breakdowns summing to the total, CSV quoting. |
| `AdvertisingApiIntegrationTest` | Every FR5 user story in one pass over HTTP, plus RBAC and validation shapes. |

`AdminUserControllerTest` fails on this branch for an unrelated, pre-existing
reason: the test requests `/api/admin/users` while `AdminUserController` is mapped
at `/api/users`. Both files are byte-identical to `origin/FR-Admin`.
