# UI verification and remaining service boundaries

Verified on 2026-10-09 against the current local source.

- Production frontend build succeeds; 64 frontend tests pass.
- Public channel response and account access controls: 17 targeted backend tests pass.
- Live MySQL-backed API returns the saved catalogue and public creator directory. No new demonstration accounts or catalogue records were inserted during verification.
- Guest landing, catalogue filters and channel pages use API records. Missing thumbnails have an explicit neutral state. Decorative cinematic photographs do not advertise playable films.
- Account and notification popups fit desktop and mobile viewports; keyboard dismissal restores focus. The 320px viewer header fits. System appearance follows the OS, and reduced motion disables animated scene changes and pointer parallax.
- Watch later waits for the server response, preserves saved state on failure, and coalesces duplicate requests.
- Test-only role screenshots use isolated browser response mocks. No fixture account selection or mock transport ships in the application.

## Service boundaries

The existing backend still lacks email password recovery, self-service viewer-to-creator conversion, channel moderator assignments, and offline downloads. Their UIs do not claim success. Playlists, queue and followed-channel selections remain account-scoped data stored in this browser; playlist sharing and channel alert promises are unavailable. Existing checkout/refund services explicitly simulate payment and never claim real money movement. Database records already present were preserved.

## Visual review

The Screening Room direction, photographic deck, softer light appearance and popup fixes were inspected at desktop and phone sizes. The automated comparison with the generated concept is below its fidelity threshold. Its measurements and state are in `.impeccable/review/diff/` and `.impeccable/build/state.json`; no historical phase passes or exact reproduction approval are asserted. This remains an open visual-review limitation, separate from the functional checks above.

## Local development

The frontend is served at http://127.0.0.1:5175 and proxies the current Spring Boot API at port 8081. Start the configured MySQL service before starting the backend. Development seeding remains opt-in; live data is not replaced by fixtures on an API failure.
