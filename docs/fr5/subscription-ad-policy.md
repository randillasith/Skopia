# Subscription-aware advertisement delivery

FR5 uses the latest integrated video, billing and notification services. The system/light/dark UI preference also applies to the current subscription, announcement and notification screens; video and ad overlays retain their dark media palette.

| Viewer state | Advertisements |
| --- | --- |
| Guest or Free account | Eligible scheduled ads on playable public videos |
| Active MONTHLY or YEARLY pass | No advertisements on any video or slot |
| Expired, cancelled, pending or future pass | Ad-supported viewing on playable videos |
| Other plan names | Ad-supported by default |
| Locked premium or unpublished video | No ads and no ad impressions |

Creators can own passes and receive the same benefits as registered viewers. Staff roles and a video's own premium tier do not independently grant ad-free viewing. The existing billing feature is a simulation; its active demo passes exercise the same eligibility rules.

`SubscriptionBenefits` defines current plan benefits. `BillingService.hasAdFreeSubscription` requires an active viewer account and a stored subscription with `ACTIVE` status, `startDate <= now`, and `endDate > now`. Neither the legacy `isPremium` profile flag, auto-renew setting, client-supplied viewer IDs nor text in the plan's benefit description can grant the exemption. Cancellation and approved refunds revoke it immediately; expiry does not depend on a scheduled sweep.

The plan catalog and subscription status return `adFree`, so the pass UI describes the server's policy. `/api/ads/active` independently checks playback and the current subscription on every request before selecting placements or writing impressions. An ad-free response is `200 []`. Direct impression submissions cannot bypass the subscription, playback, campaign dates, ad status or placement targeting checks. The client waits for account resolution before requesting a break and creates a fresh break when the title or account changes. The feature player has no separate demo ad.

Normal guest redirects remain available at `GET /api/ads/click/{id}`. The UI uses `POST` on the same path through its bearer-authenticated API helper, then opens the tracked destination. This preserves ownership checks for signed-in viewers without placing tokens in URLs.

Verification includes the complete backend suite on Java 17 and frontend tests, lint and production build. FR5 regression tests cover both passes, invalid terms, unknown plans, stale premium flags, all slot positions, unavailable videos, direct impression validation, forged IDs, authenticated clicks, and checkout → plan change → cancellation. Test configurations use independent H2 databases to avoid losing seeded plans when Spring caches multiple configurations.

Requirements consulted: [FR5 user stories](https://drive.google.com/file/d/1zobaA9StaNG4hvtoTRLTZP7GA8b88uYR/view) and [project design document](https://drive.google.com/file/d/1iaqm6jZWOEF-0q8z6cy3zWTJFsjIOGcr/view). These specify scheduling, targeting, expiry and advertising labels. The subscription exemption above is the policy added for this implementation.
