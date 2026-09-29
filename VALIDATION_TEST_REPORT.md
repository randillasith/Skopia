# Validation Test Report

## Summary

- Test date: 2026-09-21
- Backend: Java 17
- Database: XAMPP MySQL (`skopia`)
- Servlet target: Tomcat 9 / Servlet API 4.0.1
- Validation checks passed: 17
- Validation checks failed: 0
- Java compilation: PASS (8 source files)
- JavaScript syntax: PASS
- Web XML parsing: PASS
- Final result: **ALL VALIDATION TESTS PASSED**

## Implemented validation

Validation is enforced in both the frontend and backend. Browser validation provides immediate feedback, while Java validation protects the API when requests bypass the browser.

| Field or operation | Rules |
|---|---|
| Title | Required, trimmed, 3–180 characters, unsafe control characters rejected |
| Description | Trimmed, maximum 4000 characters, unsafe control characters rejected |
| Category | Positive whole-number ID and must exist in MySQL |
| Duration | Required whole number from 1–86400 seconds |
| Video URL | Required when no file is supplied; valid HTTP/HTTPS URL; maximum 700 characters |
| Thumbnail URL | Required when no file is supplied; valid HTTP/HTTPS URL; maximum 700 characters |
| Video upload | MP4/WebM/OGG/MOV, non-empty, maximum 250 MB, MIME family and binary signature checked |
| Thumbnail upload | JPG/PNG/WebP, non-empty, maximum 10 MB, MIME family and binary signature checked |
| Access | Only `FREE` or `PREMIUM` |
| Status | Only `PUBLISHED` or `DRAFT` |
| Comment | Required after trimming; maximum 1000 characters |
| Search | Maximum 100 characters |
| Resource IDs | Positive whole numbers only |
| Playback position | Whole number from 0–86400 seconds |
| JSON requests | Must use `Content-Type: application/json` |
| References | Video, category, and parent comment references are checked before writes |

## Automated test results

| Test | Expected behavior | Result |
|---|---|---|
| Valid create | Create a video with valid values | PASS |
| Valid update | Update title, access type, and duration | PASS |
| Duration persistence | Save and read updated duration `125` | PASS |
| Short title | Reject a one-character title | PASS |
| Zero duration | Reject duration `0` | PASS |
| Fractional duration | Reject duration `12.5` instead of truncating it | PASS |
| Unknown category | Reject category ID `99999` | PASS |
| Unsafe URL scheme | Reject a `javascript:` video URL | PASS |
| Invalid access type | Reject access value `ADMIN` | PASS |
| Fake image signature | Reject non-image content named as PNG | PASS |
| Zero resource ID | Reject video ID `0` | PASS |
| Empty comment | Reject a whitespace-only comment | PASS |
| Negative progress | Reject playback position `-1` | PASS |
| Wrong content type | Reject JSON operation sent as `text/plain` | PASS |
| Missing interaction video | Reject a like for video ID `999999` | PASS |
| Cross-video parent comment | Reject a parent comment belonging to a different video | PASS |
| Cleanup | Delete all temporary validation records | PASS |

## Database cleanup

Temporary validation videos IDs `9` and `10` were deleted after testing. No validation test video remains in the database.

## Payment validation verification (2026-09-22)

| Test | Expected behavior | Result |
|---|---|---|
| Missing payment fields | Reject an empty checkout payload with HTTP `400` | PASS |
| Unknown plan | Reject `WEEKLY` | PASS |
| Short cardholder | Reject a one-character name | PASS |
| Card characters | Reject non-digit separators such as `x` | PASS |
| Luhn checksum | Reject an invalid card checksum | PASS |
| Expired card | Reject a past `MM/YY` value | PASS |
| Far-future expiry | Reject expiry more than 20 years ahead | PASS |
| Security code | Reject a non-numeric CVV | PASS |
| Update status | Reject unsupported `FAILED` client update | PASS |
| Refund reversal | Prevent `REFUNDED` from returning to `SUCCEEDED` | PASS |
| Ownership/authentication | Reject payment access without a session | PASS |

All payment validation tests used a temporary account, which was removed afterward with its cascading records.
