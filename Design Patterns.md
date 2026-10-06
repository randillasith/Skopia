# Design patterns in Skopia FR1

This document applies the supplied design pattern lecture notes to **Video Content, Playback and Viewer Interaction Management** in the current Spring Boot and React project. The selected patterns are Strategy (Part II, PDF pages 3–24) and Observer (Part I, PDF pages 29–42).

## Strategy: choose the video playback access rule

The access decision has two interchangeable rules. `VideoAccessService` is the context; it selects a strategy from the video's access tier at runtime.

| Lecture role | Source file | Responsibility |
| --- | --- | --- |
| Strategy interface | `src/main/java/org/gp14/skopia/video/VideoPlaybackStrategy.java` | Defines `canPlay(userId)` |
| Concrete strategy | `FreeVideoPlaybackStrategy.java` | Allows a published free video |
| Concrete strategy | `PremiumVideoPlaybackStrategy.java` | Requires `BillingService.hasActivePremium(userId)` |
| Context | `VideoAccessService.java` | Applies shared owner/draft checks, selects the rule, and serves `canPlay`/`requirePlayback` callers |

The shared checks run before the strategy: the owner may play their own draft, while a nonowner cannot play an unpublished video. A missing tier retains the project's free-video behavior. An unknown named tier is denied rather than granted access. The existing `VideoService` and `UploadedMediaController` both use `VideoAccessService`, so API responses, view/progress operations, and protected local uploads use the same decision.

```text
VideoService / UploadedMediaController
                ↓
        VideoAccessService
          ├─ owner and publication checks
          └─ VideoPlaybackStrategy
               ├─ FreeVideoPlaybackStrategy
               └─ PremiumVideoPlaybackStrategy
```

## Observer: respond to playback state

The HTML video element is the subject. React's `onPlay`, `onPause`, `onTimeUpdate`, `onEnded`, and `onError` handlers in `frontend/src/components/player.tsx` observe its events and update player state. For catalogue records without a media file, the simulated player clock updates the same `playing` state.

`Player` now notifies its page through `onPlaybackStarted` when playback actually starts. `frontend/src/routes/viewer.tsx` observes that notification to add the video to local watch history and send one view-count request. A per-video guard stops repeated play events and rerenders from counting another view. Opening a watch page without pressing Play no longer counts a view. Existing `onTimeChange` observations continue to save watch progress; likes and comments remain direct user actions, not Observer implementations.

## Why these two

Strategy fits the varying free and premium entitlement algorithms; Observer fits browser playback events and the page's reaction to playback. The lecture's Singleton, Factory, and Decorator patterns would add extra structure without a matching FR1 need in this codebase.

## Verification

`VideoAccessServiceTest` covers premium entitlement, owner/draft visibility, the free strategy, unknown tiers, and avoiding a billing lookup for free videos. On Windows, use Java 17 and run `./mvnw.cmd -DskipFrontend=true -Dtest=VideoAccessServiceTest test` from the project root. Run `npm test` and `npm run build` from `frontend`. See `DESIGN_PATTERN_TEST_REPORT.md` for the actual test results and the separate security integration failure.
