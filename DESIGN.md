---
name: Skopia
description: A calm screening room for films, creators, and precise platform work.
colors:
  brand-violet: "#7559ff"
  brand-cyan: "#25c7f7"
  deep-violet: "#5b3fe6"
  violet-hover-light: "#6544f0"
  violet-hover-dark: "#8b6fff"
  canvas-light: "#dcd9e7"
  surface-light: "#efedf4"
  raised-light: "#e5e1ec"
  inset-light: "#d6d3df"
  plum: "#282435"
  muted-plum: "#564e65"
  subtle-plum: "#60576f"
  rule-light: "#c9c2d4"
  rule-strong-light: "#b6aec4"
  canvas-dark: "#080d1c"
  surface-dark: "#0b1122"
  raised-dark: "#0f1628"
  inset-dark: "#060a16"
  white: "#ffffff"
  muted-dark: "#94a2be"
  subtle-dark: "#7a8aa9"
  rule-dark: "#1a233d"
  rule-strong-dark: "#242e4c"
  danger-light: "#be2449"
  danger-dark: "#ff6b8a"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(36px, 4.5vw, 64px)"
    fontWeight: 760
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(28px, 3vw, 42px)"
    fontWeight: 760
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Instrument Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Instrument Sans Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  data:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.16em"
rounded:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "28px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  group: "24px"
  section: "32px"
  wide: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand-violet}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "var(--color-raised)"
    textColor: "var(--color-ink-50)"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    textColor: "var(--color-fg-muted)"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-quiet:
    textColor: "var(--color-fg-subtle)"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-danger:
    backgroundColor: "rgb(246 61 104 / .1)"
    textColor: "var(--color-tone-danger-400)"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  screening-primary:
    backgroundColor: "{colors.deep-violet}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "13px 20px"
  input:
    backgroundColor: "var(--color-inset)"
    textColor: "var(--color-fg)"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "40px"
  filter-selected:
    backgroundColor: "var(--color-fg)"
    textColor: "var(--color-canvas)"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  lightbox:
    backgroundColor: "#000"
    textColor: "{colors.white}"
    rounded: "{rounded.lg}"
---

# Design System: Skopia

## Overview

**Creative North Star: "The Screening Room"**

The Screening Room pairs a matte silver-lilac canvas and plum lettering with photographic screens, restrained violet actions, and dark media surfaces. Ink remains the dark appearance. The guest experience is spacious and cinematic; viewer and staff shells retain compact navigation, readable records, and the same typography and controls.

The binding Skopia name, supplied logo, tagline, four brand colors, and three self-hosted type families are retained. System appearance is the default; explicit Light and Dark preferences share one store and synchronize across controls, browser tabs, and live operating-system changes. Atmospheric mountain, city, and forest images are editorial brand art; they do not represent playable catalogue entries.

**Key Characteristics:**
- Matte neutral surfaces with restrained violet actions.
- Condensed Archivo headings, quiet Instrument Sans copy, JetBrains Mono data.
- Dimensional photographic screens and darker media frames.
- Compact work surfaces with explicit loading, empty, and failure states.

## Colors

Silver-lilac and plum carry the light interface; ink carries dark appearance and media, with fixed brand sign colors across both.

### Primary
- **Brand Violet:** standard primary buttons, active markers, and selected navigation.
- **Deep Violet:** guest Explore actions and image-overlay actions, with white lettering.
- **Violet Hover:** separate observed light and dark hover colors keep controls legible in their resolved appearance.

### Secondary
- **Brand Cyan:** media sign details and dark-mode accents. Light interface cyan text uses the deeper semantic tone from the stylesheet rather than the bright brand fill.

### Neutral
- **Silver-lilac Canvas / Soft Surface / Raised Surface / Inset:** page, panels, controls, and recessed fields in light appearance.
- **Plum / Muted Plum / Subtle Plum:** primary copy, supporting copy, and captions in light appearance.
- **Ink Canvas / Dark Surface / Dark Raised / Dark Inset:** the corresponding dark hierarchy.
- **White / Muted Dark / Subtle Dark:** copy on dark surfaces.
- **Rule / Strong Rule:** mode-specific fine dividers and control outlines.
- **Danger:** appearance-aware destructive text; success, warning, premium gold, and cyan similarly use the source's semantic `tone-*` roles.

**The Two Grounds Rule.** Resolve interface surfaces and text through appearance tokens; media artwork and overlays retain their dark ground.

The frontmatter records literal source values. Runtime `--color-canvas`, `--color-fg`, and related semantic variables resolve to the current appearance. Legacy `ink-*` utility names also adapt in light mode; they do not always mean dark ink. Browser selection, carets, scrollbars, focus, and tabular numerals are themed by `index.css`.

## Typography

**Display Font:** Archivo Variable, with the source's sans-serif fallbacks.
**Body Font:** Instrument Sans Variable, with the source's sans-serif fallbacks.
**Label/Mono Font:** JetBrains Mono Variable for data.

All three families are self-hosted through pinned `@fontsource` packages. Body enables kerning, contextual alternates, and optical sizing. Shared marquee headings use the real width axis (84%); guest section headings use width 85. Condensation gives headings presence without adding decorative labels.

### Hierarchy
- **Display:** the experience heading uses the frontmatter display role.
- **Headline:** guest section headings use the frontmatter headline role.
- **Title:** lead catalogue titles use the frontmatter title role; smaller tiles use 16px and 14px bold Archivo.
- **Body:** viewer descriptive copy uses the frontmatter body role, including an observed 70ch measure. Guest supporting copy uses 17px at 1.65–1.7 line height and narrower 365px or 42ch measures.
- **Label:** standard medium buttons use the frontmatter label role; small controls use 13px.
- **Data:** the letterboard role is uppercase, tracked mono. IDs, timestamps, and table numbers also use mono at 11–13px without requiring letterboard tracking.

**The Three Voices Rule.** Use Archivo for headings, Instrument Sans for interface copy, and JetBrains Mono for references, timecodes, and measured data.

The guest three-line hero currently uses weight 850 and `clamp(76px, 8.7vw, 134px)`, with breakpoint variants. Its larger scale is an approved surface-concept exception, not a reusable display token for other surfaces.

## Layout

Guest content has a 1440px maximum and 48px outer gutters, reduced to 32px at 1100px and 20px at 760px. The hero uses unequal columns, then a single column below 760px. The film shelf changes from five columns to three at 1100px and two at 760px. Experience imagery and copy stack on mobile; the pass action moves below its copy. Navigation wraps its text links to a second row.

Viewer navigation uses a desktop rail of 232px, collapsible to 68px, below a sticky header. Staff consoles use a 240px rail; both become drawers below the `lg` breakpoint (1024px). Shared work surfaces use tight 4–16px groups and 24–48px separation. Staff tables become labelled record blocks below `md` (768px); tabs scroll rather than wrap.

Menus are portalled to the document body, clamped 12px from viewport edges with an 8px anchor gap, and flip above when space demands it. Their maximum height follows available space. Dialogs are portalled, height-bounded to `calc(100dvh - 3rem)`, with scrollable bodies and fixed header/footer regions. They sit toward the bottom on mobile and center from `sm` (640px).

## Elevation & Depth

Matte tonal layering supplies the ground; offset soft shadows supply lift. Light appearance uses lower-opacity ink shadows while dark appearance uses stronger black shadows. The sidecar records both `e1`–`e4` source definitions and the screen-deck shadow. Media lightboxes retain inset violet/cyan sign rules; these are native frame details rather than ambient colored halos.

**The Offset Depth Rule.** Use the existing offset, softly blurred elevation vocabulary for lifted surfaces; inset sign rules belong to media frames.

The cinematic screen deck is the dimensional signature: three photographic 16:9 screens recede in perspective, with brightness marking depth. The front frame spans 72% of its stage; the city frame spans 78% at a 16% offset, and the forest frame spans 72% at a 29% offset, keeping the screen fan within desktop and mobile layouts. Previous/next controls change the scene on demand; there is no autoplay. Mouse tilt writes local CSS properties and skips reduced-motion users. Deck transitions use 700ms marquee easing. The shared loading indicator keeps the supplied logo readable inside a violet-and-cyan orbit while an actual request is pending. The orbit turns linearly over 2.4 seconds; the logo gently scales from 0.97 to 1 with restrained opacity change. Menus enter over 160ms; buttons transition over 200ms and press subtly.

Reduced motion disables deck transitions, tilt tracking, loader animation, and menu animation. Static deck rotations and rear-screen perspective remain in the current CSS. Reduced motion here means suppressing animated transitions and pointer response while preserving the static screen fan. Shared Motion-driven lightbox lift remains a pre-existing implementation limitation rather than a reduced-motion guarantee.

## Shapes

Controls use gently curved small corners; fields and standard buttons share the small radius. Guest calls to action use medium corners, catalogue lightboxes use large corners, experience windows and menus use extra-large corners, and mobile dialogs use the larger dialog radius. Filter chips and deck arrows are pill/circular exceptions. Fine borders define controls and records; clipped photographic frames protect the imagery without turning every content region into a card.

## Components

### Buttons
Compact, tactile controls. Standard variants are primary, secondary, ghost, quiet, and danger; medium size is 40px high with 16px horizontal padding. Small is 32px high; large is 48px. Standard primary uses fixed brand violet and white text; the guest action uses deep violet. Hover changes fill or foreground; press scales to 0.975 for standard buttons and 0.98 for guest actions. Disabled/loading controls suppress activation and show reduced opacity. Use the shared focus treatment.

### Chips
Guest category filters use a pill silhouette and 10px by 14px padding. Selected foreground/background swap to the current primary text and canvas roles, expressed with `aria-pressed`. Lifecycle letterboards use tracked mono, fine borders, and semantic state tones; preserve the record's supplied lifecycle vocabulary.

### Cards / Containers
Catalogue media uses a dark lightbox with clipped large corners, inset sign rules, and ambient elevation. `PosterPlate` displays uploaded artwork and an explicit “No thumbnail” fallback for missing or failed images. Compact fallback plates omit redundant title lettering. Ordinary content surfaces use tonal fields and rules; the lightbox is a media primitive, not a universal wrapper.

### Inputs / Fields
Inset background, small corners, a fine strong-rule border, 40px height, 12px horizontal padding, and 14px body type. Hover strengthens the border; focus switches it to violet. Field labels, hints, invalid messages, and disabled opacity come from the shared primitives. Placeholders use the resolved subtle foreground. Textareas resize vertically; select fields retain a drawn chevron.

### Navigation
The supplied brand mark sits alongside Archivo lettering. Shared navigation uses compact 13–14px interface text, semantic hover colors, and active-region markers. Account and notification menus escape sticky/transformed shells through portals. Menus focus their first item, support arrow/Home/End navigation, dismiss on Escape or outside interaction, and return focus to the trigger when dismissed by keyboard. Dialogs trap Tab focus and restore the prior focused element.

### Cinematic Deck and Loading Frames
The deck and experience window use published catalogue thumbnails and link to their actual watch pages. Missing artwork stays visibly unavailable; no generated landscape stands in for a creator upload. Its scene caption announces changes politely; only the active scene is exposed to assistive technology. Drawn SVG arrows have explicit previous/next labels and 44px targets. Loading uses a polite status label with the decorative logo and orbit hidden from assistive technology. Errors offer retry; empty catalogue states say what is missing without inserting fictional titles.

## Do's and Don'ts

### Do:
- **Do** use the shared appearance store and semantic text tones in both modes.
- **Do** use uploaded thumbnail URLs for catalogue media and show “No thumbnail” when absent or broken.
- **Do** use published catalogue artwork for landing features and show missing media honestly.
- **Do** retain visible focus, honest retry/empty/loading states, and viewport-bounded menus and dialogs.
- **Do** preserve the pinned self-hosted fonts, supplied logo, and binding brand colors.

### Don't:
- **Don’t** present generated brand landscapes as catalogue titles or invented thumbnail artwork.
- **Don’t** use raw dark-theme neutral values for interface copy on light surfaces.
- **Don’t** turn a landing-page composition into a mandatory layout for staff consoles.
- **Don’t** describe stale Figma mappings or planned backend behavior as shipped truth.
- **Don’t** inherit oversized surface lettering, kickers, or reduced-motion drift as reusable system rules.

Current documentation drift is intentionally not repaired outside this file: PRODUCT.md still describes dark-first and old prototype evidence; earlier Figma mapping and the stylesheet mirror comment are stale. This document records the source UI and makes no claim that Figma was updated. The approved hero display scale remains a surface exception; incomplete suppression of shared Motion-driven hover lift is not canonized. Backend persistence limitations belong to functional review, not visual tokens.
