# FR5 regression results 8 October 2026

The two failed FR5 cases in the supplied Chrome test report were repaired.
All five advertisement positions were exercised in installed Google Chrome
against the real local Spring Boot API. The original Word report was not edited.

## Environment and scope

- Branch: `fr5-ad-selection-strategy`, based on latest `origin/main` (`68dc594`).
- Backend: Java 17, Spring Boot, disposable H2 in MySQL compatibility mode.
- Browser: installed Google Chrome, headed desktop at 1440 by 1000 and mobile
  viewport at 390 by 844, local port 8083.
- Real 24-second MP4 feature, uploaded image/video creative, seeded marketing and
  administrator accounts, and a freshly registered viewer.
- Campaign and ad management, playback, checkout, and reporting actions performed
  through browser controls. API calls prepare fixtures and verify persisted data.
- Both/neither target requests and repeat clicks also checked directly through the
  API because ordinary UI controls cannot construct those malformed/retry requests.
- Serving-outage and broken-creative checks intentionally abort network requests.
  Other scenarios use real unmodified API responses.

## Automated verification

| Check | Result |
| --- | --- |
| Full backend suite | 154 tests passed, 0 failures/errors/skips |
| Frontend suite | 42 tests passed across 8 files |
| Frontend production build | Passed; existing bundle-size warning remains |
| Frontend lint | Exit 0; existing project warnings remain |
| Chrome scenarios | 18 passed, 0 failed |
| Browser runtime exceptions | No uncaught JavaScript or React update errors |
| Git whitespace validation | Passed |

## Browser scenarios

| Scenario | Result |
| --- | --- |
| Marketing/admin access and ordinary-viewer denial | Pass |
| Save DRAFT, reject bad dates, upload image, choose title, activate and confirm | Pass |
| Create MIDROLL campaign with uploaded video | Pass |
| Create POSTROLL campaign | Pass |
| Create OVERLAY campaign with category targeting | Pass |
| Create LOBBY campaign | Pass |
| Reject unsupported media, mismatched MIME, spoofed content, and files over 50 MB | Pass |
| Both/neither and duplicate targeting API safeguards | Pass |
| All five positions: real playback, initial skip delay, tracked link, fullscreen mid-roll pause/resume, post-roll | Pass |
| Pause/resume and inactive-creative suppression in viewer browser | Pass |
| Idempotent clicks, matching CSV totals, inclusive date filter, empty historical range and invalid range | Pass |
| Creative edit, placement identity preservation, priority edit, duplicate exclusion, target add/remove | Pass |
| Automatic image-ad completion and campaign search/empty results | Pass |
| Serving outage and broken media continue to feature playback | Pass |
| Edit campaign dates to expire it, verify viewer suppression, then archive it | Pass |
| Synthetic MONTHLY checkout and ad-free suppression for every position | Pass |
| Mobile watch and campaign layouts; watch page has no horizontal overflow | Pass |
| Browser runtime errors | Pass |

The all-position check confirms that the feature's media element pauses at the
midpoint and resumes at the same position. The fullscreen element contains the
mid-roll advertisement. Overlay playback does not pause the feature and records
one selection across the mid-roll interruption. Lobby appears outside playback.
Post-roll finishes before the existing next-title action is released.

## Evidence and limits

Reproducible runner: `frontend/e2e/fr5.cjs` (`npm run test:fr5`, with Playwright
available as described in `design-pattern-and-testing.md`). Local evidence is in
`output/fr5-regression/`: structured `results.json`, screenshots, and the downloaded
`campaign.csv`. Generated media and screenshots are not source changes in the PR.

The full repository automated suite ran, but browser regression here is focused
on FR5 and its playback/subscription integration. Unrelated failures listed for
other functions in the Word report are outside this change. Production MySQL and
the hosted deployment were not exercised, and no real payment was made.
