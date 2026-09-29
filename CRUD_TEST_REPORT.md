# CRUD and Interaction Test Report

## Test environment

- Test time: 2026-09-21 11:09:18 +05:30
- Application URL: `http://127.0.0.1:8080/untitled1`
- Runtime: Smart Tomcat / Apache Tomcat 9.0.102
- Database: XAMPP MySQL on port 3306
- Database name: `skopia`
- API health check: `ok`

## Test summary

- Passed: 10
- Failed: 0
- Result: **ALL TESTS PASSED**

## Operation results

| Operation | Request | Test performed | Result |
|---|---|---|---|
| Create | `POST /api/videos` | Created a published test video | PASS |
| Read | `GET /api/videos/7` | Read the new video and verified its title | PASS |
| Update | `PUT /api/videos/7` | Changed the title, description, and access type | PASS |
| Update verification | `GET /api/videos/7` | Verified title `CRUD Test Video Updated` and access `PREMIUM` | PASS |
| Like | `POST /api/videos/7/like` | Added the viewer's like | PASS |
| Unlike | `POST /api/videos/7/like` | Removed the viewer's like | PASS |
| Watchlist add | `POST /api/videos/7/save` | Added the video to the viewer's watchlist | PASS |
| Watchlist remove | `POST /api/videos/7/save` | Removed the video from the viewer's watchlist | PASS |
| Comment | `POST/GET/DELETE` comment endpoints | Created, read, and deleted comment ID 3 | PASS |
| Delete | `DELETE /api/videos/7` | Deleted the test video | PASS |

## Delete verification

After deletion, `GET /api/videos/7` returned HTTP `404`, confirming that the video no longer exists.

## Final database state

The temporary video, like, watchlist entry, and comment used by this test were removed. No test video was left in the database.

## CRUD coverage

- **Create:** Video record inserted successfully.
- **Read:** Inserted video retrieved successfully.
- **Update:** Video metadata changed and verified successfully.
- **Delete:** Video removed and its absence verified successfully.

## Payment CRUD verification (2026-09-22)

Payment CRUD was exercised end to end through the standalone HTTP server and XAMPP MySQL using a temporary authenticated viewer account.

| Operation | Request | Test performed | Result |
|---|---|---|---|
| Create | `POST /api/payments` | Created a validated monthly demo payment | PASS |
| Read list | `GET /api/payments` | Returned exactly the new owner-scoped payment | PASS |
| Read item | `GET /api/payments/{id}` | Returned the new payment by ID | PASS |
| Update | `PUT /api/payments/{id}` | Changed plan to yearly and status to refunded | PASS |
| Update verification | Update response | Verified plan, status, and recalculated amount `99.00` | PASS |
| Delete | `DELETE /api/payments/{id}` | Deleted the owned payment | PASS |
| Delete verification | `GET /api/payments/{id}` | Returned HTTP `404` | PASS |
| Authentication | `GET /api/payments` without a session | Returned HTTP `401` | PASS |
| Sensitive data | List response | Full card number and CVV were absent | PASS |

The temporary payment and account were deleted after testing. No payment test data remains.
