# Wiring the UI to the API

What each screen reads and writes, what is still a prototype, and why.

The frontend was built as a prototype against a module of made-up data. This
branch replaces that source with the API wherever an API exists, and leaves it in
place — visibly — where one does not. The rule throughout: **no control that
cannot do anything.** A field the server will not store is shown disabled with a
note rather than left looking editable, and a figure that could not be read shows
a dash rather than a zero.

## The two seams everything else hangs off

### Identity

`lib/session-context.tsx` holds the session. It stores one thing: the server's
account id. On every load that id goes back to `GET /api/auth/me`, and what the
account may do comes from the answer — nothing about capability is decided in the
page.

`lib/accounts.ts` translates the server's single `roleType` into the three
independent grants the UI models (`lib/session.ts`): a platform staff role, a
channel, and moderator rights on someone else's channel. `MARKETINGOFFICER`,
`SUPPORTOFFICER` and `ADMINISTRATOR` map to the three staff roles;
`CONTENT_CREATOR` is not staff, because owning a channel is its own grant.

Every request that acts for somebody sends `X-User-Id`. That is the platform's
existing convention. It is not authentication and is not treated as such.

### The catalogue

`lib/catalogue.ts` holds the API's shape and the mapping to the `Video` the
screens read. `lib/useCatalogue.tsx` loads it once and shares it.

The prototype's `Video` is richer than the API's row, so the mapping is explicit
about what is derived and what is simply not known:

| UI field | Where it comes from |
| --- | --- |
| `billing` | derived from `status`; anything unrecognised reads `IN REVIEW`, never `NOW SHOWING` |
| `runtime` | `durationSeconds`, formatted |
| `premium` | `accessType == PREMIUM` |
| `progress` | `lastPosition / durationSeconds` |
| `seed` | derived from the id, so a title's poster is the same on every load |
| `genre` | **not stored by the server.** Empty, so it matches no named genre |
| `captions` | **not stored.** Always empty rather than claiming a track that is not there |
| `comments` | not counted by the catalogue endpoint; the watch page counts its own thread |

The catalogue is re-read whenever the acting account changes, because `liked`,
`saved` and where-you-left-off are answered per caller.

## What each screen does now

### Reads and writes the API

| Screen | Endpoints |
| --- | --- |
| Lobby, Browse, Category, Explore, Trending | `GET /api/videos`, `GET /api/categories` |
| Search | `GET /api/videos?search=` (debounced); refinements filter the hits |
| Watch | `GET /api/videos/{id}`, `POST .../view`, `POST .../like`, `POST .../progress`, comments |
| Watch later, History | `GET /api/watchlist`, `GET /api/history`, `POST /api/videos/{id}/save` |
| Channel page, Following | the catalogue, filtered to the channel's titles |
| Sign in, Sign up | `POST /api/auth/login`, `/register`, `GET /api/auth/check-handle` |
| Profile | `PUT /api/users/{id}/profile`, `DELETE /api/users/{id}` |
| My reports, Report modal | `POST /api/reports`, `GET /api/reports/viewer/{id}` |
| Complaint queue, detail, history | `/api/complaints/*`, joined to the reports behind them |
| Studio library, upload, edit, analytics | `GET /api/videos?scope=mine`, `POST/PUT/DELETE /api/videos` |
| Admin dashboard, accounts, moderation | `GET /api/users`, activate/deactivate, the complaint queue |
| Campaigns (FR5) | unchanged — already wired |

### Still prototype data, because no backend exists

Subscriptions and billing; notifications and announcements; channel records
themselves (names, taglines, follower counts); playlists, the queue and downloads;
channel-scoped moderation; the admin activity log, plans, refunds and settings;
live streams on Explore.

These are left reading `lib/data.ts` and `lib/session.ts`. Nothing about them was
faked further, and nothing about them claims to be saved.

## Things the API does not do yet

These are stated on screen rather than worked around:

- **No genre.** The search filter is disabled and the studio field says so.
- **No caption tracks.** Every title shows none.
- **No forgetting a watch.** Removing one from history hides it in this browser;
  there is no endpoint for it, and it comes back if site data is cleared.
- **No granting a staff role.** The admin accounts table states each role and
  cannot change it. `StaffSeedData` creates one support officer and one
  administrator in development so those consoles can be opened at all.
- **No channel records.** A creator's channel is matched to the prototype's list
  by handle. A creator whose handle names no known channel still reaches the
  studio.
- **`/api/users` is unauthenticated.** Password hashes no longer serialise, but
  anyone can still list every account. That needs real authentication, which is
  out of scope here.

## Bugs this surfaced

Wiring a screen to an endpoint is the first time anybody finds out whether the
endpoint does what the screen says. Six things did not:

1. **Every viewer shared one account.** `VideoController` hardcoded viewer 1 and
   creator 2, so one watchlist, history and set of likes was shared by everybody
   and every upload landed on one channel.
2. **Password hashes were public.** `GET /api/users` serialised the entity,
   including `passwordHash`, and asks for no credentials.
3. **Suspending an account did nothing.** The administration endpoints write
   `DEACTIVATED`; login checked `BLOCKED` and `SUSPENDED` only. The account could
   still sign in, while the modal said it could not.
4. **A suspended account read as active** in the UI, because the two modules spell
   the same state differently.
5. **Short titles were never recorded in history.** The progress write is what
   creates the history row, and it only ran after a minute of playback.
6. **Registration ignored the creator checkbox**, because the field is `roleType`
   and the UI sent `role`. Everyone became a viewer.

## Running it

Skopia runs on MySQL. You need a MySQL server and a `skopia` database — the
connection string below creates it on first run if it is not there.

**Once**, copy the example config and edit it for your machine:

```bash
cp src/main/resources/application.properties.example src/main/resources/application.properties
```

The real `application.properties` is gitignored, so your credentials stay on your
machine. It defaults to `root` on `localhost:3306` with no password; if that is
not you, edit the file or set `SKOPIA_DB_URL`, `SKOPIA_DB_USER` and
`SKOPIA_DB_PASSWORD` in the environment instead.

Hibernate derives the schema on startup (`ddl-auto=update`). If you would rather
own it yourself, run `src/main/resources/schema.sql` against the empty database
first — that is the EER diagram written out as DDL.

Then, in one terminal:

```bash
./mvnw spring-boot:run
```

and in another:

```bash
npm --prefix frontend run dev
```

The UI is on 5175 and proxies `/api` and `/uploads` to the API on 8081.

On a fresh database, the seeds create these accounts. All of them use the
password `skopia`, and they exist only outside the `prod` profile:

| Handle | Reaches |
| --- | --- |
| `m.madhusara` | the advertising console |
| `k.laknadi` | the complaint queue |
| `p.punsara` | the administration console |
| `meridian` | the creator studio |

Everyone else signs up through the UI.

### One jar

`./mvnw clean package` builds the React app and puts it inside the jar, so
`java -jar target/skopia-0.0.1-SNAPSHOT.jar` serves the API and the UI together
on 8081 with no dev server. `-DskipFrontend=true` skips the frontend build when
you only want the API.

### Tests

```bash
./mvnw test
```

Tests run against in-memory H2 in MySQL compatibility mode, so the same mappings
and the same JPQL are exercised without a test run needing — or being able to
touch — your real database. That is the only place H2 appears; the application
itself only ever runs on MySQL.
