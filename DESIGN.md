# Design

The visual system Skopia actually ships. Everything below was read out of the built
interface — `frontend/src/index.css`, `frontend/src/components/`, and the captures in
`.impeccable/review/` — not out of intentions. Where the build and an intention disagree, the
build wins and is recorded as it is.

Skopia is a venue, not a feed. A video is a backlit poster in a lightbox, never a card, and its
lifecycle is stated on a changeable-letter board. Viewers move through front of house; Creator,
Marketing, Support and Admin work back of house. The two share one language and not one layout.

## Where the system lives

| Concern | File |
|---|---|
| Every token — colour, type, radius, elevation, easing | `frontend/src/index.css` (`@theme`) |
| Browser surfaces, reduced motion, responsive table rules | `frontend/src/index.css` (`@layer base`, media query at the foot) |
| Lightbox, Letterboard, PosterPlate, Stations, MarqueeRule | `frontend/src/components/world.tsx` |
| Buttons, fields, tables, tabs, modal, toast, empty state | `frontend/src/components/primitives.tsx` |
| App shells, role switcher, role guard | `frontend/src/components/Shell.tsx` |
| Routes and their role guards | `frontend/src/App.tsx` |

A Figma file mirrors the token layer one to one: collections `Skopia · Primitives` (49
variables), `Skopia · Semantic` (33) and `Skopia · Scale` (20), plus 17 text styles and 7 effect
styles. That file is on a Figma Starter plan, which caps a collection at one mode — so the
semantic collection carries **Dark only**. Dark is the canonical theme. Light-mode values are
not built, in Figma or in CSS, and `:root` declares `color-scheme: dark` outright.

## Colour

Four colours were fixed by the client and are not negotiable: `#7559FF` violet, `#25C7F7` cyan,
`#5B3FE6` deep violet, `#080D1C` ink. Everything else is a ramp derived from them.

**The palette is locked.** `@theme` in `index.css` is the only place a colour may be declared.
No component introduces a hex value of its own; the two places a raw `rgb()` appears are the
`--sign-violet` / `--sign-cyan` channel pairs used for alpha tinting, and they resolve to the
same two brand colours.

### Ramps

- **Violet** `50 → 950`, brand at `500` `#7559FF`, pressed at `700` `#5B3FE6`.
- **Cyan** `50 → 950`, accent at `400` `#25C7F7`.
- **Ink** `0 → 950`, the ground at `900` `#080D1C` and insets at `950` `#060A16`.
- **Status** success `#34D399`, warning `#F5A524`, danger `#F63D68`, premium gold `#FFB443`, each
  with a 400/500/600 step.

### How colour is rationed

Violet and cyan are *illuminated-sign light*. They belong to marquee rules, lightbox frames,
tally chips, the active nav region and the primary action. They are never scattered as ambient
glow across a surface, and no element gets a coloured halo as decoration. On a staff console the
only saturated things on screen are the status boards and the one active row marker.

Two gradient data bars were removed during the finish pass in favour of flat brand fill —
a violet-to-cyan gradient on a chart bar is the most recognisable tell of a generated interface,
and it carried no information the flat fill does not.

### Text colour is a contrast rule, not a preference

On the `ink-900` ground:

| Token | Value | Contrast | Use |
|---|---|---|---|
| `ink-0` | `#FFFFFF` | 18.5:1 | Primary text, headings |
| `ink-200` | `#94A2BE` | 7.6:1 | Secondary body |
| `ink-300` | `#7A8AA9` | 5.6:1 | Tertiary, captions, table headers, placeholders |
| `ink-400` and darker | — | ≤ 2.9:1 | **Borders and surfaces only** |

`ink-300` was lifted from `#6B7B9C` to `#7A8AA9` during the finish pass so tertiary copy clears
WCAG AA with margin rather than scraping 4.58:1. **`ink-400`, `ink-500` and `ink-600` must never
carry text.** They are the border and surface family. Every text use of them was swept out.

## Typography

Three voices, no more.

- **Archivo** — the marquee. All display and heading type, set at `font-stretch: 84%` via the
  `.font-marquee` utility, with `letter-spacing: -0.02em`. It is a real condensed grotesque and
  carries the lettering the whole thesis rests on.
- **Inter** — the workhorse. All interface and body copy.
- **JetBrains Mono** — data. References (`RPT-2291`, `CMP-410`), timecodes, timestamps, dates,
  and every figure inside a table.

All three load from Google Fonts in `frontend/index.html`. **This is a known weakness**: the
marquee voice is a third-party network dependency on a world whose thesis is its lettering. Self-
hosting is the recorded next step.

### The ramp

| Style | Face | Size / line | Tracking |
|---|---|---|---|
| Display/2XL | Archivo ExtraBold | 56 / 64 | −2.5% |
| Display/XL | Archivo ExtraBold | 44 / 52 | −2% |
| Display/L | Archivo Bold | 36 / 44 | −1.5% |
| Heading/XL | Archivo Bold | 30 / 38 | −1.2% |
| Heading/L | Archivo Bold | 24 / 32 | −1% |
| Heading/M | Archivo SemiBold | 20 / 28 | −0.6% |
| Heading/S | Archivo SemiBold | 17 / 24 | −0.4% |
| Body/L | Inter Regular | 17 / 26 | −0.1% |
| Body/M | Inter Regular | 15 / 23 | 0 |
| Body/S | Inter Regular | 13 / 20 | 0 |
| Label/L · M · S | Inter Semi Bold | 15 / 13 / 12 | 0 to +0.2% |
| Label/XS | Inter Semi Bold | 11 / 14 | +2.4%, uppercase |
| Mono/M · S | JetBrains Mono | 13 / 12 | 0 |

Hero headlines use `clamp()` rather than a fixed step — the lobby headline runs
`clamp(2.75rem, 8.5vw, 5.75rem)` so it stays the largest thing on the page at any width.

**Hierarchy is carried by size and span, not by repetition.** The lobby's billing block sets one
headline at display scale, two supporting titles at roughly half, then the long tail as a dense
justified paragraph. Browse repeats the pattern: one lead poster, one title spanning two columns,
two smaller stacked beside it, then a ruled list. A grid of identically sized cards is refused as
page structure.

## Scale

Spacing `0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`.
Radius `xs 6 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 28 · pill 999`.

Elevation — every shadow carries an offset and a soft blur; a zero-offset halo is decoration, not
depth.

| Token | Value |
|---|---|
| `e1` | `0 1px 2px rgb(0 0 0 / .3), 0 1px 3px rgb(0 0 0 / .18)` |
| `e2` | `0 4px 8px -2px rgb(0 0 0 / .4), 0 2px 4px -1px rgb(0 0 0 / .28)` |
| `e3` | `0 12px 24px -6px rgb(0 0 0 / .5), 0 4px 8px -2px rgb(0 0 0 / .3)` |
| `e4` | `0 24px 48px -12px rgb(0 0 0 / .6), 0 8px 16px -4px rgb(0 0 0 / .35)` |

Easing: `--ease-marquee: cubic-bezier(0.16, 1, 0.3, 1)` for reveals and `--ease-house:
cubic-bezier(0.32, 0.72, 0, 1)` for drawers.

## The three primitives

### Lightbox

A backlit poster in a luminous frame. Black plate, `radius-lg`, an inset violet rule at 28%
opacity, a cyan top edge at 22%, and `e3` beneath. **Never a card, and nested lightboxes are
always wrong.** Interactive instances lift 4px on hover over 380ms.

### Letterboard

Lifecycle stated in one uppercase word, JetBrains Mono at 11px with `0.16em` tracking on a
bordered field tinted from its own state colour.

The catalogue vocabulary: `NOW SHOWING` · `COMING SOON` · `HELD OVER` · `PULLED` · `IN REVIEW`.
Complaints add `SUBMITTED` · `UNDER REVIEW` · `NEEDS INFO` · `RESOLVED` · `CLOSED`, and campaigns
`ACTIVE` · `SCHEDULED` · `EXPIRED` · `PAUSED` · `DRAFT`. One word per state, everywhere — the same
board renders a video's billing, a complaint's status and a campaign's schedule.

### PosterPlate

Authored placeholder poster art. Six seeded compositions in the locked palette, over which the
title sets in Archivo ExtraBold with a cyan house rule above it and the studio and runtime in
mono beneath. The lettering is the point: the plate is a poster, not a swatch.

Two rules the build enforces:

- `lettering={false}` on any plate under roughly 140px. Below that the type cannot be read and the
  adjacent row title already names the record.
- The title wraps at 13 characters to at most two lines, and the size is then fitted to the plate
  (`284 / (longest × 0.52)`, clamped to 15–36) so lettering never runs off the edge.

**These are placeholders and are labelled as such in the interface.** Replace them with real
poster artwork before production.

### Stations

A staged commit with a marked point of no return, used by the upload flow and the payment flow.
Completed stations sit on a raised surface, the current one is cyan-tinted, and the link before
the irreversible step is drawn in danger red. Past it the earlier stations lock.

## Components

Button (`primary` · `secondary` · `ghost` · `quiet` · `danger`, three sizes, with loading and
disabled), Field, Input, Textarea, Select, SearchInput, Toggle, Checkbox, Tabs, Modal, Toast,
EmptyState, Avatar, Meter, Section, and two honesty markers described below.

**Every interactive surface ships hover, focus, disabled and — where it applies — loading, error
and empty.** Empty states are written, never generic: they name what is missing and offer the
action that fills it.

### Staff tables

Hairline rules, tabular numerals, uppercase mono column heads, no card padding standing in for
structure. Row hover tints; a clickable row says so. This is the densest surface in the system
and the reference every other staff table follows.

The hero-metric tile row — big number, small label, four across — was removed from the complaint
queue and the campaign list during the finish pass. It is refused outright: the tab row directly
beneath already carried the same counts inline, and four tiles to carry six characters is the
opposite of the density this system is built for.

## Honesty markers

Skopia's documentation leaves a number of product facts explicitly undecided. The interface
never invents them.

- **`Placeholder`** — a dashed, dimmed chip reading `—` for a value with no decision behind it:
  prices, billing periods, refund amounts.
- **`Working`** — a dotted underline marking a name that is a working choice, not a settled fact.
  Plan names carry it everywhere they appear.
- **Provisional notes** — surfaces whose figures depend on an undefined formula say so in plain
  words at the foot. The complaint queue and both advertising views carry one.

If a future decision settles one of these, remove the marker. Do not add a marker to a value the
documentation has actually decided.

## Motion

**One authored moment: the letterboard flip.** When an object changes lifecycle state its status
board flips character by character over ten frames at 28ms, resolving left to right, and the tone
switches to the target state's colour as it goes. It is the system's whole state-change
vocabulary, reused everywhere a state changes. Under `prefers-reduced-motion` it does not run —
the resolved string is set outright.

Everything else is interaction-driven and quiet: modal and toast enter/exit, the tab underline
sliding on `layoutId`, the toggle knob, the lightbox hover lift, wizard panels mounting on a step
change, upload progress.

**Decorative first-paint entrance animations are banned in this build, for two reasons.** They
were scattered effects rather than one moment — a fade on every section is the thing the craft
floor refuses. And concretely, in this React 19 + Motion combination they stranded: elements that
animated on a route's first paint stayed at `opacity: 0` permanently, which silently blanked the
admin dashboard's stat tiles, the pricing cards and the checkout result icon. Motion that mounts
in response to a user action works correctly and is kept. If you add an entrance animation to
something that renders on first paint, verify the element's computed opacity afterwards.

A global `prefers-reduced-motion` block in `index.css` collapses all CSS animation and transition
durations and forces `scroll-behavior: auto`.

## Browser surfaces

The parts nobody draws still carry the design, and browser defaults belong to no design system.
Themed in `@layer base`: text selection (violet at 32%), the caret (cyan), scrollbars (`ink-600`
thumb on a transparent track), the focus ring (2px `violet-400` at 2px offset, on
`:focus-visible`, never removed), link underline offset, placeholder colour, and
`font-variant-numeric: tabular-nums` on every table.

## Layout and responsive behaviour

Front of house runs to a `1500px` measure with a sticky translucent header and the marquee rule
beneath it. Back of house is a fixed 240px rail plus a fluid console; the rail collapses to a
drawer below `lg`. **Regions swap contents rather than reflow between routes** — the shell holds
still while the body changes.

Breakpoints are Tailwind's defaults. What actually changes:

- Alert banners stack their action below the copy under `sm` instead of squeezing it.
- Stat rows run two-up under `sm`, never four tall rows.
- Tabs scroll horizontally rather than wrapping under their own underline.
- **Operate tables stack below `md`.** Each row becomes a labelled record block — the record's
  own name leads unlabelled, then each field is captioned with its column name in mono. `Table`
  takes a `labels` array for this; if you add a column, add its label. A horizontal scroller is
  not a responsive composition and is not used.

## Access

Role-based access decides reach, and the interface says so rather than hiding controls. The
`RequireRole` guard wraps every back-of-house route group: Creator Studio needs `creator`, the Box
Office `marketing`, the House Log `support`, the Projection Booth `admin`; an administrator
reaches all of them. Account-bound surfaces need any signed-in role. A role that cannot reach a
console gets a named access screen stating who it is for and offering the way back — never a
blank page or a vanished link.

The role switcher in the header and sidebar is **prototype scaffolding** so all six roles can be
demonstrated without a backend. It is not part of the product.

## Known gaps

Recorded honestly rather than left for someone to discover:

1. Poster plates are authored placeholders, not real artwork.
2. The three faces load from the Google CDN and should be self-hosted.
3. The client bundle is a single ~168KB gzipped chunk; route-level code splitting is untouched.
4. Fixture data is thin — 12 videos, 10 accounts, 5 campaigns, 4 complaints — so sustained-session
   density, sticky headers and large-list behaviour are undemonstrated.
5. Only 1440px desktop and 390px mobile were verified. Intermediate laptop widths are unchecked.
6. Light mode does not exist, in CSS or in Figma.
