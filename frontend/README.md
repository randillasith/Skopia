# Skopia — UI

The web interface for Skopia, the web-based video browsing system (SE2030, group
26-MTR-SE2030-14). React 19 + TypeScript + Vite + Tailwind CSS v4 + Motion + React Router.

## Running it

Two modes, depending on what you are doing.

**Working on the UI** — Vite dev server with hot reload, backend separate:

```bash
npm --prefix frontend install && npm --prefix frontend run dev
```

Open http://localhost:5175. Calls to `/api` are proxied to Spring Boot on 8080
(`server.proxy` in `vite.config.ts`), so the browser sees a single origin and neither
side needs CORS configuration. Start the backend alongside it if you need the API:

```bash
./mvnw spring-boot:run -DskipFrontend=true
```

**Running the whole application** — one process serving the UI and the API together:

```bash
./mvnw spring-boot:run
```

Open http://localhost:8081. No hot reload, but this is what the built artifact does.

## How it is built

Maven owns the whole build. `./mvnw package` produces one runnable JAR containing both
the API and the UI:

1. `frontend-maven-plugin` downloads a project-local Node into `target/` — nothing is
   installed globally, and the Node version is pinned in `pom.xml` so every machine and
   CI agent builds identically — then runs `npm ci` and `npm run build`.
2. `maven-resources-plugin` copies `frontend/dist` into `target/classes/static`, which
   Spring Boot serves.

The bundle lands in `target/`, never in `src/main/resources/`. That is the Maven
contract — `src/` is what you write, `target/` is what the build produces — and it means
`./mvnw clean` removes the bundle and no build output is ever committed.

Add `-DskipFrontend=true` to build the backend alone, without Node. Useful on a machine
that only touches Java, and in CI when a job does not need the UI.

Because routing happens in the browser, `SpaWebConfig` (in
`src/main/java/org/gp14/skopia/web/`) serves a real file when one exists and otherwise
falls back to `index.html`, so a deep link such as `/studio/analytics` survives a
refresh. Paths under `/api` and `/assets` are excluded from that fallback and answer 404
honestly — an unknown endpoint must stay an API error, and a stale hashed bundle should
report as missing rather than as a page of HTML.

Pinned: Node **v24.21.0** (LTS). Do not drop below 22.12 — Vite's Rolldown bindings
declare `"node": "^20.19.0 || >=22.12.0"`, and on an older runtime npm silently skips the
platform-specific binary, failing later with a misleading `Cannot find native binding`.

## Who can do what

Login is **session-based**. Everyone signs up as the same kind of account; nothing about it is
special at creation. What an account can do beyond watching comes from three grants that are
independent of one another — see `src/lib/session.ts`.

| Grant | Scope | Granted by |
|---|---|---|
| **Staff role** — `marketing`, `support`, `admin` | Platform-wide | An administrator |
| **Channel** — publish and manage your own videos | Your channel | Yourself. No approval step |
| **Moderator** — publish, remove and block comments | One channel | That channel's owner |

They are deliberately not one enum. A person can own a channel *and* moderate somebody else's;
a support officer can own a channel too. Collapsing them into a single role field is what makes
a permission model start lying — it forces a moderator to look platform-wide when the grant only
ever covered one channel, and it makes publishing look like something an administrator permits.

Guards ask what an account **holds**, not what it **is**: `RequireAuth`, `RequireChannel`,
`RequireModerator` and `RequireStaff` in `src/components/Shell.tsx`, wired in `src/App.tsx`. An
account that cannot reach a surface gets a named refusal that says who *can* let them in, rather
than a silently hidden link — hiding teaches nothing to somebody arriving from a shared URL.

Note that `/studio/create` sits **outside** the channel guard. That guard is what sends you there.

The **account menu** (top right, or the foot of a staff sidebar) lists the grants the signed-in
account actually holds, and carries an identity switcher for the prototype. The identities are
chosen to show the three grants are independent: `R. Perera` moderates two channels without
owning one, and no staff role carries a channel. Signing in with any account's email address
resolves the session to that account.

## What is real and what is not

There is no backend wired up. Every title, name, figure and metric in `src/lib/data.ts` is
synthetic placeholder content.

Values the project documentation leaves **undecided** are never given an invented number. They
render as a visible placeholder (`—`, dashed border, tooltip) so nobody mistakes a mock for a
decision: plan prices, durations and entitlements; the payment gateway provider; refund approval
authority; accepted video and advertisement formats and sizes; duplicate-detection rules; subtitle
languages; complaint status and priority value sets; valid impression and click definitions;
the detailed permission set; log retention and alert thresholds; playback quality levels.

Poster artwork is authored placeholder art (`PosterPlate` in `src/components/world.tsx`), not
photography. Replace it with real imagery before this goes anywhere near production.

## Routes, by functional requirement

### Entry and account (minor functions)

| Route | Screen |
|---|---|
| `/` | Guest lobby — the public landing |
| `/login` · `/signup` · `/reset` | Sign in, register, password reset |
| `/onboarding` | Pick categories and genres that feed recommendations |
| `/profile` | Account settings, including closing the account |
| `/help` | Help and support, with a route into filing a complaint |

### FR1 · Video content, playback and viewer interaction

| Route | Use case |
|---|---|
| `/browse` | UC-FR1-01 — browse the catalogue, billing-ranked |
| `/search` | UC-FR1-01 — search and filter, including the empty-result state |
| `/category/:name` | UC-FR1-01 — browse by category |
| `/watch/:id` | UC-FR1-01 — playback, controls, captions, pre-roll advertising, the playback-failure state (demo button), reporting |
| `/watchlist` · `/history` | UC-FR1-02 — favourites, watch history with resume, empty states |
| `/studio/create` | UC-FR1-03 — open a channel. Self-service, no approval step |
| `/studio` | UC-FR1-03 — the creator's video library |
| `/studio/upload` | UC-FR1-03 — staged upload with validation and the duplicate warning |
| `/studio/video/:id` | UC-FR1-03 — edit metadata, captions, playback settings, archive or delete |
| `/studio/analytics` | Creator performance |
| `/studio/moderators` | Appoint and remove moderators on your own channel |
| `/studio/channel` | Channel settings |

### Channel moderation

Granted by a channel owner, and scoped to that channel. Not a staff role.

| Route | Screen |
|---|---|
| `/moderate` | Comment queue for the channels you moderate |
| `/moderate/history` | Every publish, removal and block, with who decided it |

### FR2 · Subscription and payment

| Route | Use case |
|---|---|
| `/plans` | UC-FR2-01 — available passes |
| `/checkout` | UC-FR2-01 — staged payment with an explicit point of no return |
| `/checkout/result` | UC-FR2-01 — success with receipt, and the failure branch (toggle at the foot) |
| `/subscription` | UC-FR2-01 — renew, change or cancel |
| `/billing` | UC-FR2-01 — payment history and receipts |
| `/admin/plans` · `/admin/refunds` | UC-FR2-02 — administer plans and approved refunds |

### FR3 · Video reporting and complaint management

| Route | Use case |
|---|---|
| `/reports` | UC-FR3-01 — file a report and track its status and history |
| `/queue` | UC-FR3-02 — the support complaint queue |
| `/queue/:id` | UC-FR3-02 — assign, set status and priority, record a resolution, notify |
| `/queue/history` | UC-FR3-02 — search closed complaints |

### FR4 · Notification and recommendation management

| Route | Use case |
|---|---|
| `/for-you` | UC-FR4-01 — rule-based recommendations |
| `/notifications` | UC-FR4-01 — the notification list |
| `/settings/notifications` | UC-FR4-01 — preferences; report-status notices cannot be turned off |
| `/admin/announcements` | UC-FR4-02 — compose and publish, with a viewer preview |

### FR5 · Advertisement management

| Route | Use case |
|---|---|
| `/campaigns` | UC-FR5-01 — campaign list, with expired campaigns flagged |
| `/campaigns/new` | UC-FR5-01 — staged builder: details, creative, targeting, schedule |
| `/campaigns/:id` | UC-FR5-01 — edit, pause, resume, remove |
| `/campaigns/performance` | UC-FR5-02 — delivery and performance |

Advertising identification is not optional: the pre-roll on `/watch/:id` and the creative preview
in the builder both carry an `ADVERTISEMENT` board that cannot be switched off.

### FR6 · Administrative and platform management

| Route | Use case |
|---|---|
| `/admin` | UC-FR6-03 — dashboard |
| `/admin/accounts` | UC-FR6-01 — accounts, role changes, suspend and restore |
| `/admin/roles` | UC-FR6-01 — the three grants, who gives each, and the staff roles granted so far |
| `/admin/moderation` | UC-FR6-02 — reported content and moderation decisions |
| `/admin/logs` | UC-FR6-03 — activity log with filters |
| `/admin/settings` | UC-FR6-03 — platform configuration |

## The design system

`src/index.css` is the single token layer and mirrors the Figma file's three variable collections
(`Skopia · Primitives`, `Skopia · Semantic`, `Skopia · Scale`) one to one. The palette is locked:
nothing outside that block may introduce colour.

Three primitives carry the world, all in `src/components/world.tsx`:

- **Lightbox** — a backlit poster in a luminous frame. Never a card.
- **Letterboard** — lifecycle stated in one uppercase word (`NOW SHOWING`, `COMING SOON`,
  `HELD OVER`, `PULLED`, `IN REVIEW`). When a state changes it flips character by character.
  That flip is the system's single authored motion moment, and it holds still under
  `prefers-reduced-motion`.
- **Stations** — a staged commit with a marked point of no return, used by the upload and
  payment flows.

Typography: **Archivo** is the marquee voice (condensed to 84% via a real width axis, not a
faked one), **Instrument Sans** is the interface workhorse, **JetBrains Mono** carries
references, timecodes and every figure in a table. All three are self-hosted through
`@fontsource` — no CDN request, no third-party dependency, and the versions are pinned in
`package-lock.json` so a build next year renders as it does today.

**The glance** is the one desktop-only interaction. A lightbox is a backlit surface, so on a
fine pointer it catches light where the cursor is: `Lightbox interactive` writes `--mx`/`--my`
straight onto the node and `.lightbox-glance` in `index.css` draws a radial gradient there.
The coordinates never enter React state — routing them through a `useState` would re-render the
whole shelf on every `mousemove`. It is gated on `(hover: hover) and (pointer: fine)`, because
without that gate a touch device leaves the highlight stuck wherever the last tap landed, and
gated again on `prefers-reduced-motion`, where the sheen holds still at the centre.

Three rules worth knowing before you edit:

- **`ink-400`, `ink-500` and `ink-600` are border and surface tokens only.** On the `ink-900`
  ground they fall below 2.9:1, so they must never carry text. `ink-300` (`#7a8aa9`) is the
  floor for secondary and tertiary copy and clears WCAG AA.
- **Operate tables stack below `md`.** `Table` takes a `labels` array of column names; under
  768px each row becomes a labelled record block instead of a horizontal scroller. If you add a
  column, add its label.
- **Never navigate with `window.location.href`.** It tears the application down and rebuilds it
  from scratch. Use `useNavigate` or a `<Link>`.

## Connecting it to the backend

The Spring Boot service lives in `../src/main/java/org/gp14/skopia`. Nothing here calls it yet.
Replace the exports in `src/lib/data.ts` with real fetches against `/api/...`; the component
layer takes the same shapes. Use the relative path rather than an absolute URL — the dev proxy
and the packaged application both serve the API from the same origin, so no base URL or
environment switch is needed.
