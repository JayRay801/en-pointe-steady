# En Pointe & Steady — Team Agent Roles & Go-Live Protocol

This repository uses a zero-dependency vanilla ES-module Progressive Web App (PWA) architecture hosted on GitHub Pages (`https://jayray801.github.io/en-pointe-steady/` from branch `main`, root `/`).

## Team Roles

| Role ID | Title | Primary Responsibility |
|---|---|---|
| `implementer` | Application & Feature Engineer | Implements features and fixes across `index.html`, `styles.css`, `app.js`, `foods.js`, `history.js`, `crypto.js`, and `sw.js` with zero third-party dependencies. |
| `qa-verifier` | QA & Regression Verifier | Runs `node tests/verify_app.mjs`, headless browser DOM/E2E checks, and enforces zero-PII and clinical math invariants. |
| `privacy-auditor` | Privacy & Security Auditor | Verifies zero plaintext PII in the public repository, AES-256-GCM encryption integrity, and PIN-gated admin isolation. |
| `deploy-verifier` | **Deployment & Go-Live Verification Agent** *(Mandatory Post-Update Role)* | Runs pre-flight readiness checks, enforces the explicit **Confirm to Go Live** gate before publishing, and verifies live GitHub Pages + Service Worker + asset parity after deployment. |

---

## Mandatory Post-Update Role: Deployment & Go-Live Verification Agent (`deploy-verifier`)

Whenever the app is updated, **`deploy-verifier` MUST run** before any release is declared live.
Detailed operational instructions live in `.agents/skills/deploy-go-live/SKILL.md` and are backed by `tests/verify_deploy.mjs`.

### 3-Phase Go-Live Protocol

#### Phase 1 — Pre-Flight Readiness
1. Run the full application verification suite:
   ```bash
   node tests/verify_app.mjs
   ```
   All checks must pass (including zero-PII checks).
2. Verify Service Worker readiness in `sw.js`:
   - Every entry in `APP_SHELL` exists on disk.
   - `CACHE_NAME` is bumped relative to the currently live `https://jayray801.github.io/en-pointe-steady/sw.js` whenever app assets have changed.
   - `app.js` registers `./sw.js` with `{ updateViaCache: "none" }`.
3. Verify git working tree readiness (`git status --porcelain`) and run:
   ```bash
   node tests/verify_deploy.mjs --pre
   ```

#### Phase 2 — Confirm to Go Live Gate
1. Present a clear **Go-Live Readiness Summary** containing:
   - **Target Branch & Live URL**: `main` → `https://jayray801.github.io/en-pointe-steady/`
   - **Service Worker `CACHE_NAME`**: local version vs. currently live version
   - **Test Suite Status**: `node tests/verify_app.mjs` and `node tests/verify_deploy.mjs --pre` results
   - **Changed / Staged Files**: summary of files ready to ship
2. **Explicitly ask and confirm to go live** before committing/pushing to `origin/main` or declaring the release live.
3. **Fail-Closed Rule**: Never confirm or proceed to go-live if any pre-flight check fails.

#### Phase 3 — Post-Deploy Live Verification
After changes are committed and pushed to `origin/main`, run:
```bash
node tests/verify_deploy.mjs --live
```
This verifies:
1. **Git Parity**: Local `HEAD` matches `origin/main` (`HEAD === origin/main`) and working tree is clean.
2. **GitHub Pages Build & Deployment**: `gh api repos/JayRay801/en-pointe-steady/pages`, `pages/builds/latest`, and `deployments` show `status: "built"` / `"success"` for the exact `HEAD` commit SHA with no build errors.
3. **Cache-Busted HTTP 200 & SHA-256 Asset Parity**: Fetching `sw.js` and every `APP_SHELL` URL with cache-busting (`?cb=<ts>` and `Cache-Control: no-cache`) returns HTTP `200`, live `sw.js` `CACHE_NAME` matches local `sw.js`, and SHA-256 digests match local `HEAD` files.
4. **Headless Browser Smoke Check**: If Chromium/Chrome is available, loads `https://jayray801.github.io/en-pointe-steady/` with zero console/page errors.
5. **Final Verdict**:
   - Emits `GO_LIVE_CONFIRMED` (exit code `0`) **only** when all gates pass.
   - Emits `GO_LIVE_BLOCKED` (exit code non-zero) with exact failure reasons if any gate fails.
