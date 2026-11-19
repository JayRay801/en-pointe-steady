---
name: deploy-go-live
description: Deployment & Go-Live Verification Agent (deploy-verifier) workflow for En Pointe & Steady. Runs pre-flight readiness checks, enforces the explicit confirm-to-go-live gate, monitors GitHub Pages deployment, and verifies live HTTP, Service Worker, and browser parity.
---

# Deploy & Go-Live Verification (`deploy-verifier`)

Use this skill after any application update to verify that changes are ready, obtain explicit confirmation to go live, and prove the update is fully deployed and live on `https://jayray801.github.io/en-pointe-steady/`.

## Strict Fail-Closed Rules

1. **Never confirm go-live if any check fails.** If any gate fails, emit `GO_LIVE_BLOCKED` with the exact failing gate and remediation steps.
2. **Never push or declare go-live without explicit confirmation** at Phase 2 (Confirm to Go Live Gate).
3. **Never rely on local tests alone** to declare an update live — live verification (`--live`) must prove `HEAD === origin/main`, GitHub Pages build `status: "built"` for that exact `HEAD` SHA, live `sw.js` `CACHE_NAME` match, and SHA-256 asset parity.

---

## Step-by-Step Protocol

### Phase 1: Pre-Flight Readiness

1. Run the application test suite and pre-flight deployment check:
   ```bash
   node tests/verify_app.mjs
   node tests/verify_deploy.mjs --pre
   ```
2. Confirm:
   - `node tests/verify_app.mjs` exits `0` (`ALL_VERIFY_APP_CHECKS_PASSED`), including zero-PII checks.
   - All `sw.js` `APP_SHELL` entries exist on disk.
   - `sw.js` `CACHE_NAME` has been bumped compared to live `https://jayray801.github.io/en-pointe-steady/sw.js` whenever app assets changed.
   - `app.js` registers `./sw.js` with `{ updateViaCache: "none" }`.
   - `git status --porcelain` contains only intended release files (no temp files, secrets, or stray artifacts).

If any Phase 1 check fails, stop immediately, report `GO_LIVE_BLOCKED`, and fix the issue before proceeding.

---

### Phase 2: Confirm to Go Live Gate

Present a structured **Go-Live Readiness Summary** to the user/orchestrator:

- **Target Branch & URL**: `main` → `https://jayray801.github.io/en-pointe-steady/`
- **Service Worker Cache**: Local `CACHE_NAME` vs. Live `CACHE_NAME`
- **Verification Status**: `verify_app.mjs` + `verify_deploy.mjs --pre` status
- **Changed Files**: List of modified/added files to be deployed

Then **explicitly ask to confirm go-live** (e.g., *"Pre-flight checks passed. Confirm to go live and push to `origin/main`?"*).
Do **not** run `git push` or emit `GO_LIVE_CONFIRMED` until confirmation is received.

---

### Phase 3: Push, Deploy Monitoring & Live Verification

Once go-live is confirmed:

1. Commit and push the verified changes to `origin/main`.
2. Run the live verification script with build polling:
   ```bash
   node tests/verify_deploy.mjs --live --poll-seconds 120
   ```
3. `verify_deploy.mjs --live` checks:
   - **Git Sync**: `git status --porcelain` is clean and `git rev-parse HEAD === git rev-parse origin/main`.
   - **GitHub Pages Build**:
     - `gh api repos/JayRay801/en-pointe-steady/pages` reports `status: "built"`.
     - `gh api repos/JayRay801/en-pointe-steady/pages/builds/latest` (and/or `deployments`) reports `status: "built"` / `"success"` for the exact `HEAD` commit SHA with `error.message === null`.
   - **Cache-Busted HTTP 200 & Asset Parity**:
     - Fetches `sw.js` and every `APP_SHELL` URL using `?cb=<timestamp>` and `Cache-Control: no-cache`.
     - Asserts HTTP `200`, live `sw.js` `CACHE_NAME === local CACHE_NAME`, and SHA-256 parity between live responses and local `HEAD` files.
   - **Headless Browser Smoke Check**:
     - If Chromium/Chrome is installed, loads `https://jayray801.github.io/en-pointe-steady/` headless and verifies clean render with zero console/page errors.
4. **Final Output**:
   - On full pass: `GO_LIVE_CONFIRMED` (exit `0`). Report Commit SHA, Live URL, Active `CACHE_NAME`, Asset Parity result, and UTC Timestamp.
   - On any failure: `GO_LIVE_BLOCKED` (exit non-zero). Report the exact failed gate and remediation steps.

---

## Offline / Deterministic Self-Test

To validate the deployment verification logic offline (without network or `git push`):
```bash
node tests/verify_deploy.mjs --dry-run
```
