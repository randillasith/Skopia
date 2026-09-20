# Skopia — UI

The web interface for Skopia, the web-based video browsing system (SE2030, group
26-MTR-SE2030-14). React 19 + TypeScript + Vite + Tailwind CSS v4 + Motion + React Router.

## Running it

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Then open http://localhost:5175.

A **role switcher** sits in the top-right of the viewer chrome and at the foot of every staff
sidebar. It moves you between the six roles so you can reach every console without a backend.
It exists for the prototype only — real access is decided by role-based access control.

Routes are **guarded by role** (`RequireRole` in `src/components/Shell.tsx`, wired in
`src/App.tsx`). A role that cannot reach a console gets a named access screen rather than a
silently hidden link — Creator Studio needs `creator`, the Box Office needs `marketing`, the
House Log needs `support`, the Projection Booth needs `admin`, and an administrator can reach
all of them. Account-bound surfaces (watchlist, history, notifications, pass, billing, reports)
require any signed-in role. Start on the lobby as a Registered Viewer and switch to see this.

## What is real and what is not

There is no backend wired up. Every title, name, figure and metric in `src/lib/data.ts` is
synthetic placeholder content.

Values the project documentation leaves **undecided** are never given an invented number. They
render as a visible placeholder (`—`, dashed border, tooltip) so nobody mistakes a mock for a
decision: plan prices, durations and entitlements; the payment gateway provider; refund approval
authority; accepted video and advertisement formats and sizes; duplicate-detection rules; subtitle
languages; complaint status and priority value sets; valid impression and click definitions;
the role/permission matrix detail; log retention and alert thresholds; playback quality levels.

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
| `/studio` | UC-FR1-03 — the creator's video library |
| `/studio/upload` | UC-FR1-03 — staged upload with validation and the duplicate warning |
| `/studio/video/:id` | UC-FR1-03 — edit metadata, captions, playback settings, archive or delete |
| `/studio/analytics` | Creator performance |

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
| `/admin/roles` | UC-FR6-01 — the permission matrix (marked as a working draft) |
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

Typography: **Archivo** is the marquee voice (condensed to 84% width), **Inter** is the interface
workhorse, **JetBrains Mono** carries references, timecodes and every figure in a table.

Two rules worth knowing before you edit:

- **`ink-400`, `ink-500` and `ink-600` are border and surface tokens only.** On the `ink-900`
  ground they fall below 2.9:1, so they must never carry text. `ink-300` (`#7a8aa9`) is the
  floor for secondary and tertiary copy and clears WCAG AA.
- **Operate tables stack below `md`.** `Table` takes a `labels` array of column names; under
  768px each row becomes a labelled record block instead of a horizontal scroller. If you add a
  column, add its label.

## Connecting it to the backend

The Spring Boot service lives in `../src/main/java/org/gp14/skopia`. Nothing here calls it yet.
Replace the exports in `src/lib/data.ts` with real fetches; the component layer takes the same
shapes.
