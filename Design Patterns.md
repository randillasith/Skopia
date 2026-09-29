# Design patterns for Skopia's video module

## Scope and recommendation

This document covers **video content, playback, and viewer interaction management** in Skopia. It uses only patterns taught in the two supplied lecture notes. The strongest choices for the current code are:

| Priority | Pattern | Where it fits | Status |
| --- | --- | --- | --- |
| 1 | **Strategy** (behavioral) | Choose the `FREE` or `PREMIUM` video access rule while keeping the API and media checks consistent | Implemented in `VideoAccessPolicy.java` and used by both Java entry points |
| 2 | **Observer** (behavioral) | React to playback state changes, update controls, count a view, and save progress | Already implemented with the browser's video event listeners in `app.js` |

**Best single pattern to explain for this project: Strategy.** Free and premium videos require different access decisions, and the same decision is needed when returning video details, counting views, recording progress, and serving uploaded media. Observer is the best companion pattern for playback because the `<video>` element emits events to several independent handlers.

## 1. Strategy: video access rules

The Part II lecture defines Strategy as a family of algorithms behind one interface, selected at runtime so the client can use them interchangeably ([Part II, PDF pages 3–8](<../DesignPattern PartII.pdf#page=3>)). Skopia selects a rule from each video's `accessType`:

```text
VideoAccessPolicy (context)
  ├── AccessStrategy.decide(hasPremium)
  ├── FreeAccessStrategy     → ALLOWED
  └── PremiumAccessStrategy  → ALLOWED or PREMIUM_REQUIRED
```

The context first applies the shared content rules: a creator can access their own video, while a draft is hidden from everyone else. It then selects the `FREE` or `PREMIUM` strategy. `VideoAccessPolicy.Decision` has three results: `ALLOWED`, `HIDDEN`, and `PREMIUM_REQUIRED`.

| Video and viewer | Decision | HTTP/API effect |
| --- | --- | --- |
| Owner viewing their own video, including a draft | `ALLOWED` | Video can play |
| Nonowner viewing a draft | `HIDDEN` | 404 for protected requests |
| Published free video | `ALLOWED` | Video can play |
| Published premium video, subscribed viewer | `ALLOWED` | Video can play |
| Published premium video, unsubscribed viewer or guest | `PREMIUM_REQUIRED` | `canWatch=false`, URL omitted from video JSON; protected requests return 402 |

**Implementation:** [VideoAccessPolicy.java](src/main/java/com/skopia/VideoAccessPolicy.java) contains the interface, two concrete strategies, runtime selection, and the shared decision method. [SkopiaServer.java](src/main/java/com/skopia/SkopiaServer.java) and [SkopiaServlet.java](src/main/java/com/skopia/SkopiaServlet.java) both use it in `protectVideo`, `requireVideoAccess`, and `requireUploadAccess`. This covers the standalone server and the Tomcat servlet without keeping separate copies of the free/premium rule.

The creator and draft checks are shared conditions, rather than extra strategies, because they apply to **both** free and premium videos. The strategy varies only the rule that actually changes with `accessType`. This follows the lecture's advice to use Strategy for interchangeable behavior and avoids a class for every combination ([Part II, PDF pages 22–24](<../DesignPattern PartII.pdf#page=22>)).

## 2. Observer: playback events

The Part I lecture describes a subject that lets observers subscribe and receive updates when its state changes ([Part I, PDF pages 29–38](../Week11_Lecture_DesignPattern-Part01.pdf#page=29)). The browser provides those roles directly:

| Lecture role | Skopia code |
| --- | --- |
| Subject / concrete subject | The HTML `<video id="player">` element |
| Add an observer | `player.addEventListener(eventName, handler)` in `setupPlayer(video)` |
| Notify observers | The browser dispatches `playing`, `pause`, `timeupdate`, `seeked`, `ended`, `error`, and other media events |
| Concrete observers | Handlers that update controls and status, save watch progress, or count a view |

**Implementation:** [app.js](src/main/webapp/app.js) has `setupPlayer(video)`. Its `playing` observer sends one view-count request for the current player session and updates the UI. Its `timeupdate` observer refreshes the time display and saves progress about every ten seconds while playing. `pause`, `seeked`, and `ended` observers save the latest position; `error` shows a retry message. [public/app.js](public/app.js) has the same player logic.

Browser `addEventListener` is already an Observer mechanism, so creating another subject/observer framework around it would add classes without improving this implementation. The playback observers are for playback behavior; likes, watchlist actions, and comment CRUD are direct user actions and API calls, not Observer implementations.

## Why the other lecture patterns are not selected here

| Pattern in notes | Current project decision |
| --- | --- |
| Singleton ([Part I, PDF pages 15–27](../Week11_Lecture_DesignPattern-Part01.pdf#page=15)) | The server already owns its repository and database dependencies. A global singleton would make access and tests harder without solving a video module problem. |
| Factory ([Part II, PDF pages 26–36](<../DesignPattern PartII.pdf#page=26>)) | The module currently creates one video entity and uses one HTML5 player type. A separate object factory would add indirection without several product types to create. The small strategy selection inside `VideoAccessPolicy` is part of Strategy, not a separate Factory implementation. |
| Decorator ([Part II, PDF pages 38–49](<../DesignPattern PartII.pdf#page=38>)) | Player controls and access checks are not interchangeable wrappers around a common video object. There is no current need to combine independent runtime features through wrappers. |

## Boundaries and verification

- The Java policy controls API responses and files served from Skopia's `/uploads/` path. A creator supplied external media URL is hosted elsewhere, so Skopia cannot enforce premium access at that external host.
- The client uses `canWatch` to show the player or premium gate; the Java server remains the authority for Skopia served media and API actions.
- Verification completed: the Java policy matrix, both HTTP entry points, both JavaScript player copies, and real browser playback passed. See the [Design Pattern Test Report](DESIGN_PATTERN_TEST_REPORT.md) for cases, results, and limits.
