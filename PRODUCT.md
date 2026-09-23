# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript (Vite), Tailwind CSS, Framer Motion, React Router — confirmed by the user, who asked for "react or little better language because UI need to be little animated or responsive with premium feel". Backend is an existing Spring Boot 4.1 / Java 17 / MySQL service (`org.gp14.skopia`) in the same repository; the UI is delivered as a separate frontend workspace.

## Users

Six confirmed roles, all sharing one platform:

- **Guest Viewer** — unauthenticated. Browses the public catalogue, searches and filters, views video details, watches public videos. Cannot comment, save, subscribe or report.
- **Registered Viewer / Subscriber** — authenticated. Everything a Guest can do, plus comments, watchlist/favourites, watch history with resume, recommendations, notification preferences, subscription and payment, and submitting reports.
- **Content Manager / Creator** — uploads and maintains video records: metadata, thumbnails, captions/subtitles, playback settings. Works through validation warnings and duplicate detection. Archives or deletes records.
- **Advertising / Marketing Officer** — builds advertisement campaigns: uploads ad media or a promotional link, assigns target videos/categories, schedules start/end dates, deactivates expired ads, reviews delivery and performance.
- **Customer Support Officer** — works a complaint queue: assigns, reviews, updates status and priority, records resolutions, searches complaint history, closes resolved complaints.
- **Platform Administrator** — manages accounts, roles and permissions; moderates reported content; administers subscription plans and approved refunds; publishes announcements; reviews activity logs; changes platform configuration.

## Product Purpose

Skopia is a web-based video browsing system that lets people discover, stream and manage digital video content in one place. Viewers search and browse by category, genre and popularity, watch with full playback controls, and build personal watchlists and history. Creators upload and manage content. The platform sustains itself through premium subscriptions and an advertising module, and stays safe through reporting, complaint handling and moderation.

Success means: a viewer finds something worth watching and plays it without friction; a creator publishes a correctly-described video without a support ticket; staff resolve a complaint or campaign task without leaving their console.

## Positioning

Skopia is a single integrated platform rather than a streaming front-end bolted onto separate admin tools. The same system carries catalogue and playback, subscription and payment, reporting and complaint resolution, notifications and recommendations, advertising, and platform administration — with role-based access control deciding what each of the six roles sees. The reporting-and-complaint loop is first-class, not an afterthought: a viewer can track their own report's status through to resolution.

## Operating Context

- Browser-only, any device with a stable internet connection. No offline viewing.
- Network speed directly affects playback quality, so the interface must degrade honestly rather than hide buffering.
- Staff roles (Admin, Marketing, Support) work in sustained sessions on dense, list-heavy consoles — queues, tables, logs, campaign schedules. Viewers arrive in short, discovery-led sessions.
- Third-party dependencies: an online payment gateway and email notification service. Provider not yet selected.

## Capabilities and Constraints

Confirmed functional modules (FR1–FR6) and their use cases:

- **FR1 · Video Content, Playback and Viewer Interaction** — UC-FR1-01 Browse and Watch Videos; UC-FR1-02 Manage Viewer Interaction and Viewing Progress; UC-FR1-03 Manage Video Content and Playback Settings.
- **FR2 · Subscription and Payment** — UC-FR2-01 Manage Viewer Subscription and Payment; UC-FR2-02 Administer Subscription Plans and Refunds.
- **FR3 · Video Reporting and Complaint Management** — UC-FR3-01 Submit and Track Video or Technical Report; UC-FR3-02 Manage Complaint Resolution.
- **FR4 · Notification and Recommendation Management** — UC-FR4-01 Manage Recommendations and Viewer Notifications; UC-FR4-02 Publish and View System Announcements.
- **FR5 · Advertisement Management** — UC-FR5-01 Manage Advertisement Campaign; UC-FR5-02 Monitor Advertisement Delivery and Performance.
- **FR6 · Administrative and Platform Management** — UC-FR6-01 Manage Users, Roles and Account Access; UC-FR6-02 Moderate Platform and Administer Subscriptions; UC-FR6-03 Monitor Platform Operations and Configuration.

Minor functions also in scope: registration, login/logout, password reset, profile management, search and filtering, watch history, watchlist/favourites, notification preferences, video sharing, feedback and rating, help and support, responsive UI.

Constraints:

- Premium content is visible only to authorised subscribers.
- Advertisements must carry clear advertising identification when displayed.
- Expired or inactive advertisements must not appear in active display.
- Upload storage capacity is limited; accepted file formats and sizes are **not yet defined**.
- English only in the initial version. No live streaming, no multi-language, no AI/ML recommendations in current scope — recommendations are query/rule-based on interests, history and preferences.

Explicitly undecided (must not be invented as fact): plan names, prices, durations and entitlements; the payment gateway provider; refund approval workflow and authority; accepted video and advertisement file formats and sizes; duplicate-detection rules; initial subtitle languages; complaint status and priority value sets; valid impression and click definitions and performance formulas; the role/permission matrix detail; log retention and alert thresholds; search ranking rules and initial playback quality levels.

## Brand Commitments

- Name: **Skopia**. Tagline on the supplied logo: **"Watch Beyond Limits"**.
- Logo supplied by the user as a raster PNG (604×540, dark background baked in): a headphone-wearing figure behind a laptop showing a play glyph, above the SKOPIA wordmark where the "O" is a play button and the "A" is a solid triangle.
- Binding palette, given by the user: `#7559FF` violet, `#25C7F7` cyan, `#5B3FE6` deep violet, `#080D1C` ink. The user explicitly permits additional matching colours.
- The user asked for a "very professional look and premium look".
- Academic context that appears in project documents: module SE2030, group 26-MTR-SE2030-14, SLIIT. Six named student owners, one per FR module.

## Evidence on Hand

- Project proposal (`Skopia Web Base Video Browsing Project Proposal.docx`), use case report (`26-MTR-SE2030-14_Usecase.docx`) with 14 fully specified use cases, activity report, scrum report, and FR5 user stories — all in the user's Google Drive, read into this project's context.
- Logo PNG supplied directly by the user.
- Spring Boot skeleton in this repository: `SkopiaApplication.java`, `pom.xml` (Spring Boot 4.1.1, Java 17, Lombok, MySQL connector), `application.properties` with datasource fields left blank.
- A Google Stitch project of draft UI exists but **could not be reached** in this session (no Google session in the isolated browser, no Chrome extension connected). Nothing about its contents may be assumed.
- **No real video content, user accounts, pricing, metrics or testimonials exist.** All catalogue titles, names, figures and performance numbers in the prototype are placeholders and must be presented as such.

## Product Principles

1. **Role clarity over one-size navigation.** What a person can do is decided by their role; the interface should make the current role and its reach obvious rather than hiding disabled controls.
2. **Honest system state.** Buffering, failed payments, rejected uploads, unresolved complaints and empty results are named plainly — every use case in the documentation has explicit failure extensions, and the UI must carry them.
3. **The viewer surface sells; the staff surface works.** Discovery is cinematic and image-led. Consoles are dense, scannable and keyboard-friendly. They share one language but not one layout.
4. **Traceability.** Reports, complaints, refunds, moderation decisions and configuration changes all carry status and history. The UI shows where a thing is in its lifecycle, not just its current value.
5. **Nothing invented.** Where the documentation records an open issue, the UI shows a placeholder that reads as a placeholder rather than a fabricated fact.

## Accessibility & Inclusion

- Confirmed non-functional requirements include cross-platform compatibility, responsive UI, browser compatibility and role-based access control.
- Target WCAG 2.1 AA: body and placeholder text ≥4.5:1, large text ≥3:1, visible keyboard focus throughout, captions/subtitles are a first-class FR1 feature and must be surfaced in the player.
- Dark-first, because the confirmed base colour is `#080D1C` and the primary use scene is video viewing.
