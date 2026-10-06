# Main branch → hosted website

Skopia is hosted at `https://skopia.randillasith.me/`. The production application runs as `skopia.service` on the VPS, with its database configured in a private systemd EnvironmentFile. **Do not put credentials in GitHub or in the repository.**

A protected-branch merge or other push to `main` starts two cooperating paths:

1. `/etc/cron.d/skopia-deploy-main` runs `/opt/skopia/deploy-main.sh` every minute. It fetches only GitHub `main`, builds the Spring Boot JAR (including current React assets), backs up the previous JAR, restarts the service, probes localhost and the public HTTPS site, and rolls back on failure. It writes `/opt/skopia/.deployed-main-sha` only after success. It does not need a webhook, GitHub deploy secret, or inbound SSH access.
2. `.github/workflows/deploy-main.yml` runs on pull requests and pushes to `main`. It runs frontend tests/lint and builds/tests the backend. For a push to `main`, it waits for the public `/api/deployment` receipt to equal the **exact pushed commit SHA**, then verifies public health and the `/browse` route. The workflow fails if the VPS does not deploy that commit.

The receipt is read-only and reports only the verified Git commit, not credentials or private server state. When run locally without a valid marker, `/api/deployment` returns HTTP 503. Cron still deploys if GitHub Actions is unavailable; the workflow is an independent build/test and externally visible deployment confirmation, not the component that performs the deployment.

To check a deployment, compare the `main` commit on GitHub with `/api/deployment` and inspect the **Build and verify Skopia deployment** workflow for that commit. If a check fails, read `/opt/skopia/logs/deploy-*.log` on the VPS and `journalctl -u skopia.service`; do not manually overwrite the persistent database or uploads. A failed build or health probe should leave the previous JAR running. Merge into `main` only after review, because every main commit is a production deployment.
