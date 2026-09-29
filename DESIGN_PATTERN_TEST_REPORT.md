# Design Pattern Test Report

**Project:** Skopia — Video Content, Playback, and Viewer Interaction Management  
**Test date:** 2026-09-29  
**Patterns under test:** Strategy and Observer, as described in [Design Patterns.md](Design%20Patterns.md)  
**Final result:** **PASS — no unresolved test failures**

## Summary

| Check | Result | Evidence |
| --- | --- | --- |
| Java Strategy decision matrix | **16/16 pass** | Guest, viewer, subscriber, and creator across free, premium, published, and draft cases; invalid access type rejected |
| Standalone Java server HTTP integration | **35/35 pass** | Video JSON, view/progress authorization, uploaded media, demo subscription, draft visibility, cleanup |
| Tomcat servlet HTTP integration | **35/35 pass** | Same assertions through `/untitled1/api/*` and `/untitled1/uploads/*` |
| Observer event checks | **Pass for both `app.js` copies** | Resume, one view request, ten-second progress throttle, pause, seek, end, error, pagehide, disposal, guest behavior |
| Real browser playback | **7/7 pass** | Chrome loaded and played a local MP4, counted one view, saved history on pause/seek, disposed the player, and showed the premium gate without uncaught JavaScript errors |
| Build and syntax | **Pass** | All Java sources, including both entry points, compiled; both JavaScript files passed `node --check` |

## Test environment

- Java 25.0.2; Node.js 24.19.0; Python 3.14.7.
- Chrome 154.0.8037.58 in headless mode for the real browser test.
- MariaDB 10.4.32 in an isolated data directory under `target/design-pattern-db` on port `3339`.
- Standalone server on port `8093`, database `skopia_pattern_test`.
- Tomcat 9.0.102 on port `8094`, database `skopia_pattern_servlet`, with its base and deployed app under `target/design-pattern-tomcat`.
- The normal XAMPP database on port `3306` was not running or used.

## Strategy: decision and endpoint results

The tested implementation is [VideoAccessPolicy.java](src/main/java/com/skopia/VideoAccessPolicy.java). Both [SkopiaServer.java](src/main/java/com/skopia/SkopiaServer.java) and [SkopiaServlet.java](src/main/java/com/skopia/SkopiaServlet.java) call it for video JSON, view/progress authorization, and uploaded media. The Java matrix in [PolicyCheck.java](tests/design-pattern/PolicyCheck.java) passed all 16 cases.

| Scenario | Expected | Observed in both HTTP modes |
| --- | --- | --- |
| Guest requests a published free video | Player allowed; media URL present | HTTP 200, `canWatch=true`, URL present |
| Guest or unsubscribed viewer requests a published premium video | Gate shown; media URL withheld | HTTP 200, `canWatch=false`, URL absent |
| Guest attempts a premium view; unsubscribed viewer attempts premium progress | Blocked | HTTP 402 for both actions |
| Subscribed viewer requests premium video and records view/progress | Allowed | URL present; view and progress returned HTTP 200 |
| Guest requests an uploaded premium video file | Blocked | HTTP 402 |
| Subscriber or owner requests that uploaded premium file | Allowed | HTTP 200 with bytes matching the uploaded test file |
| Nonowner requests draft details, media, or view | Hidden | HTTP 404, including for a subscriber |
| Creator requests their own premium draft details and media | Allowed | `canWatch=true`; media returned HTTP 200 |
| Creator changes the video to published free | Guest gains access | Guest media and view returned HTTP 200 |

The uploaded media test used a small file with a valid MP4 signature to verify **access control and byte delivery**. The browser test separately used a real playable MP4. The HTTP script [http_check.py](tests/design-pattern/http_check.py) ran the same 35 assertions against the standalone server and the Tomcat servlet, using separate isolated databases. It removed its test video, uploaded file, and demo payment after each run.

## Observer: event and browser results

The tested code is `setupPlayer(video)` in [src/main/webapp/app.js](src/main/webapp/app.js) and [public/app.js](public/app.js). Their SHA-256 hashes matched during this run. The event harness in [observer-check.cjs](tests/design-pattern/observer-check.cjs) exercised each copy independently.

| Event or action | Expected | Result |
| --- | --- | --- |
| `loadedmetadata` | Resume from the saved position and show ready status | **PASS** |
| Repeated `playing` events | Update status; send one view request per player session | **PASS** |
| `timeupdate` before and after ten seconds | Throttle progress; send integer position after interval | **PASS** |
| `pause` and `seeked` | Save playback position | **PASS** |
| `ended` | Save progress with `completed=true` | **PASS** |
| `error` | Show an error message and retry button | **PASS** |
| `pagehide` | Save with `keepalive=true` | **PASS** |
| Player disposal | Remove pagehide observer, pause, clear media source, stop later progress writes | **PASS** |
| Guest progress | Do not call the progress API without a signed-in user | **PASS** |

The real browser check in [browser-observer-check.cjs](tests/design-pattern/browser-observer-check.cjs) used a temporary, playable local MP4 created by [browser_fixture.py](tests/design-pattern/browser_fixture.py). Its seven reported checks passed: media loaded, `playing` updated the UI and increased the view count exactly once, `pause` created watch history, `seeked` updated position, navigation disposed the player, an unsubscribed viewer saw the premium gate, and Chrome reported no uncaught JavaScript exceptions.

## Build and reproducibility

The standalone Strategy matrix can be rerun without a database:

```powershell
javac -encoding UTF-8 -d target/design-pattern-tests src/main/java/com/skopia/VideoAccessPolicy.java tests/design-pattern/PolicyCheck.java
java -cp target/design-pattern-tests com.skopia.PolicyCheck
node tests/design-pattern/observer-check.cjs
node --check src/main/webapp/app.js
node --check public/app.js
```

All Java source files were also compiled with the Servlet API 4.0.1 JAR, covering the standalone server and servlet classes. The HTTP tests require an isolated MariaDB instance and either the standalone server at `http://127.0.0.1:8093` or Tomcat at `http://127.0.0.1:8094/untitled1`. The latter is selected with `PATTERN_TEST_BASE` and `PATTERN_TEST_UPLOAD_DIR`. The browser script additionally requires headless Chrome exposing DevTools on port `9225` and a fixture from `browser_fixture.py setup`.

## Test corrections and limits

- An initial browser test changed only the URL hash after login. That retained the page's guest state even though the login cookie was valid, so no progress was sent. The test was corrected to perform a full page navigation after login. A second test timing issue was corrected by waiting for the home page render before opening the premium video. The final browser run passed; neither issue required an application code change.
- These tests verify access to files served by Skopia. A creator supplied external video URL is hosted elsewhere, so Skopia cannot enforce premium access at that external host. This remains the boundary described in [Design Patterns.md](Design%20Patterns.md).
- Load, concurrency, and cross-browser compatibility were outside this design pattern test run.

## Cleanup

The temporary browser video, HTTP test videos, uploaded files, and demo payments were removed. The standalone server, Tomcat, Chrome, and isolated MariaDB processes were stopped; ports `3339`, `8093`, `8094`, and `9225` were no longer listening. The isolated database files and test build artifacts remain under the ignored `target/` directory for inspection. The project's normal MySQL data was not modified.
