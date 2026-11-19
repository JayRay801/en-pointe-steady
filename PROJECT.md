# Project: En Pointe & Steady — Full Feature, Schedule, Admin, History & Personalization Update

## Architecture
- **Tech Stack**: Zero-dependency vanilla ES-module Progressive Web App (`index.html`, `styles.css`, `app.js`, `foods.js`, `history.js`, `crypto.js`, `sw.js`, `manifest.webmanifest`, `USER_GUIDE.md`, `GOOGLE_SIGNIN_PREP.md`) verified via `node tests/verify_app.mjs` and browser/DOM verification.
- **Module Boundaries & Data Flow**:
  - `crypto.js`: WebCrypto PBKDF2-SHA256 + AES-256-GCM bundle encryption (`EPSTEADY-AES256:`), Google Apps Script Cloud Sync (`pullFromCloud`, `pushToCloud`, `createDebouncedPush`), secure family support phone cipher/decoder (`resolveFamilySupportPhone`, `buildSmsHelpUri`) so the family support phone (`ODAxNDczNTczMQ==`) is never stored as raw plain-text digits in the public repository, and dormant Google Identity Services (GIS) authentication preparation hooks (`GOOGLE_AUTH_PREP_SPEC`, optional `auth` envelope in cloud sync).
  - `foods.js`: Curated 36-item POTS & Gallbladder food library (`DEFAULT_FOOD_LIBRARY`, length 36 preserved), 28 keyword estimation rules (`NUTRITION_KEYWORD_RULES`, length 28 preserved), `evaluateFoodSafety`, `estimateNutritionForQuery`, `lookupFoodOpenFoodFacts`, and `NUTRITION_SOURCES` catalog documenting scientific, clinical, and nutritional databases behind all values and recommendations.
  - `history.js`: `getLocalDateString`, `computeDailyTotals`, deterministic daily target scoring (`computeDailyScore` with 0–100% score, goals hit count, and Green/Yellow/Red color tiers indicating most goals hit vs not), `snapshotToday` (embedding daily score & targets), `upsertPastHistoryEntry` (for logging or editing missed past days), `filterHistory`, `computeHistoryStats`, `generateHistoryCsv` (preserving `"Date,Day Mode,Sodium (mg)"` prefix and appending score columns at the end), and `renderDoctorReportHtml` (including score and clinical source citations).
  - `app.js`: Pure domain state/math/schedule/role-copy helpers exported for Node.js verification + browser DOM runtime controller guarded by `if (typeof document !== "undefined")`:
    - Per-day customizable Dance & School schedule model (`weeklySchedule` for `Mon`–`Sun` + `dateScheduleOverrides` for specific dates `YYYY-MM-DD`), BAND `.ics` & text schedule sync/import (`parseBandIcsSchedule`, `parseBandTextSchedule`), dynamic daily dance duration calculation (`getDanceHoursForDate`), and Carpool subsection (supporting both School and Dance carpool rides).
    - `getCalculatedTargets(profile, dailyContext)`: Supports Male/Female biological sex (`profile.gender = "female" | "male"`, Mifflin-St Jeor `+5` for male vs `-161` for female, gender-aware calorie floor, hydration & sweat scaling) AND dynamic day-to-day dance activity duration (`dailyContext?.danceHours` or scheduled dance classes for that day, including `0` hours on rest days) while remaining 100% backward-compatible with `getCalculatedTargets(profile)` calls in existing tests.
    - Role-aware copy engine (`getRoleCopy(state)` / `renderRoleCopy()`): In Daughter's view (`viewerRole === "Dancer"`), triggers a tap-to-answer `"I feel:"` mood check-in popup modal (`#dancerCheckinModal`) each time she opens the app (in addition to the top bar indicator). In Mom's view (`viewerRole === "Mom"`), rephrases the entire app to third-person (`"The Dancer"`, dancer's name, `"they"`, `"their"`) with zero instances of first-person `"I"`.
    - User-friendly, non-technical `CLINICAL_INFO_TOPICS` and `MANUAL_SECTIONS` (zero tech jargon), SMS Help modal (`#helpModal`), PIN-secured hidden Admin Dashboard (`#adminModal` linked to the configured Script URL, housing all technical backend settings removed from regular user pages), and studio personalizations/aesthetics (`state.personalization`: curated studio color themes, dancer avatar/emblem, 1-tap header role toggle, visual score ring & calendar views).
  - `index.html` & `styles.css`: Single-page PWA shell with 3-mode Calendar View (`Month`, `Week`, `Day`) in the `📅 Schedule` tab (Month view showing calendar grid with selected day's schedule underneath; Week and Day views styled similar to Google Calendar hourly grids), Carpool subsection (School + Dance), Nutritional Sources view/modal, Past Day logging modal, Daughter app-open mood check-in popup, SMS Help modal, PIN-gated hidden Admin Dashboard, and personalized studio aesthetic themes.

## Code Layout
- `/home/antigravity/JayRay801/en-pointe-steady/index.html` — PWA HTML shell & modals
- `/home/antigravity/JayRay801/en-pointe-steady/styles.css` — Responsive CSS & studio personalization themes
- `/home/antigravity/JayRay801/en-pointe-steady/app.js` — Exported pure helpers & browser runtime controller
- `/home/antigravity/JayRay801/en-pointe-steady/foods.js` — Food library, safety evaluator & `NUTRITION_SOURCES`
- `/home/antigravity/JayRay801/en-pointe-steady/history.js` — History snapshots, `computeDailyScore`, `upsertPastHistoryEntry`, CSV & Doctor Report
- `/home/antigravity/JayRay801/en-pointe-steady/crypto.js` — WebCrypto AES-256-GCM, Cloud Sync, family support phone cipher & Google Sign-In prep hooks
- `/home/antigravity/JayRay801/en-pointe-steady/sw.js` — Offline service worker (`CACHE_NAME` bumped)
- `/home/antigravity/JayRay801/en-pointe-steady/USER_GUIDE.md` — Simple, non-technical user guide for dancers & parents
- `/home/antigravity/JayRay801/en-pointe-steady/GOOGLE_SIGNIN_PREP.md` — Technical documentation of prepped Google Sign-In architecture & future activation checklist
- `/home/antigravity/JayRay801/en-pointe-steady/tests/verify_app.mjs` — Comprehensive verification test suite
- `/home/antigravity/JayRay801/en-pointe-steady/AGENTS.md` — Team agent roles & Deployment/Go-Live Verification protocol
- `/home/antigravity/JayRay801/en-pointe-steady/.agents/skills/deploy-go-live/SKILL.md` — Deploy & Go-Live Verification Agent skill instructions
- `/home/antigravity/JayRay801/en-pointe-steady/tests/verify_deploy.mjs` — Zero-dependency Deployment & Go-Live verification script (`--pre`, `--dry-run`, `--live`)

## Feature Inventory
Every Survey feature assigned a milestone (none unassigned).
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1: Customizable Daily Dance Schedule & BAND Sync | Customize each day's Dance & School schedule (different every day, Mon–Sun + date overrides) with BAND `.ics` feed/file/text sync & manual class customizer | M1 | survey (ORIGINAL_REQUEST §1) |
| 2 | F2: Carpool as Subsection of Schedule (School & Dance) | Move Carpool into a subsection of the `📅 Schedule` tab supporting both School and Dance carpool rides | M1 | survey (ORIGINAL_REQUEST §1a) |
| 3 | F3: Calendar View (Month, Week, Day Options) | Calendar view when entering Schedule: Month view shows calendar grid with selected day's schedule underneath; Week and Day views render hourly timelines similar to Google Calendar | M1 | survey (ORIGINAL_REQUEST §1b) |
| 4 | F4: Dynamic Daily Dance Activity & Food Intake Targets | Replace static daily dance assumption with day-specific scheduled dance duration/activity (including 0 hrs on rest days) driving recommended food/calorie/water/sodium intake | M1 | survey (ORIGINAL_REQUEST §1c, 1c.i) |
| 5 | F5: Male/Female Profile Selection & Gender-Aware Recommendations | Add Male/Female selection in Profile and apply gender-specific Mifflin-St Jeor BMR (`+5` Male vs `-161` Female), calorie floor, hydration, and sweat scaling | M1 | survey (ORIGINAL_REQUEST §1d) |
| 6 | F6: Simple, Non-Technical Manual & Info Explanations | Rewrite Manual, `ℹ` Info popups, and `USER_GUIDE.md` in warm, simple, everyday language with zero technical jargon | M1 | survey (ORIGINAL_REQUEST §2) |
| 7 | F7: SMS Help Form Preloading Message & Secure Family Phone (`ODAxNDczNTczMQ==`) | Help button & form that opens native text/SMS app (`sms:`) preloaded with the user's message and securely preloads the family support phone (`ODAxNDczNTczMQ==`) via family-key-encoded cipher without raw plaintext PII in repo | M1 | survey (ORIGINAL_REQUEST §2a) |
| 8 | F8: Hidden PIN-Secured Admin Dashboard Linked to Script URL | Remove technical backend settings from regular user pages (`#pinOverlay`, `#gearModal`) and house them in a hidden PIN-secured Admin Dashboard linked to the configured Script URL | M1 | survey (ORIGINAL_REQUEST §2b) |
| 9 | F9: Future Google Sign-In Architecture Prep & Documentation | Add dormant Google Identity Services (GIS) auth hooks in `crypto.js`, `app.js`, `index.html`, and Admin Dashboard (`enabled: false`), and document clearly in `GOOGLE_SIGNIN_PREP.md` | M1 | survey (ORIGINAL_REQUEST §2c) |
| 10 | F10: Dedicated Nutritional & Recommendation Sources View | Show trusted sources used for nutritional values and POTS/Gallbladder/BMR recommendations (`NUTRITION_SOURCES`) in Food tab, Manual, and Doctor Report | M1 | survey (ORIGINAL_REQUEST §3) |
| 11 | F11: Daily Target Scoring System & Color-Coded History | Score daily target achievement (0–100% & goals hit count) and display color-coded scores (Green most goals hit, Yellow partial, Red missed) across Today and History | M1 | survey (ORIGINAL_REQUEST §4) |
| 12 | F12: Past / Backdated Record Logging for Missed Days | Add `+ Log Past Day` (and edit past day) modal in History & Today 7-day strip to add or update records from past dates | M1 | survey (ORIGINAL_REQUEST §5) |
| 13 | F13: Daughter's View App-Open "I feel:" Tap Popup | Show a tap-to-answer `"I feel:"` mood check-in popup modal each time the Daughter opens the app (in addition to the top bar indicator) | M1 | survey (ORIGINAL_REQUEST §6) |
| 14 | F14: Mom's View Full-App Third-Person Rephrasing | In Mom's view, rephrase the entire app so Mom is filling it out for her daughter—never use first-person `"I"`; use `"the Dancer"`, dancer's name, or `"they/their"` across all views, modals, manual, info, and rescue protocols | M1 | survey (ORIGINAL_REQUEST §6a) |
| 15 | F15: Personalizations & Aesthetics Enhancements | Curated studio color themes (including dark/late-rehearsal mode), dancer avatar picker, 1-tap header role toggle, visual score ring & Google Calendar-style schedule polish | M1 | survey (ORIGINAL_REQUEST §7) |
| 16 | F16: Deployment & Go-Live Verification Agent | Add a new team agent (`deploy-verifier`) + skill + `tests/verify_deploy.mjs` (`--pre`, `--dry-run`, `--live`) + `updateViaCache: "none"` in `app.js` that verifies updates are fully deployed and live on GitHub Pages and explicitly confirms to go live once ready | M3 | survey (ORIGINAL_REQUEST 2026-11-19T09:09:56Z) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Full Application Implementation & Unit/E2E Verification | Implement Features F1–F15 across `crypto.js`, `foods.js`, `history.js`, `app.js`, `index.html`, `styles.css`, `sw.js`, `USER_GUIDE.md`, `GOOGLE_SIGNIN_PREP.md`, and `tests/verify_app.mjs` | none | DONE (Gate Iteration 1 PASS: 10/10 verification suites + Headless Chromium E2E + Forensic Audit CLEAN) |
| 2 | M2: Feature #7 Soft Wellness UI, Independent Per-Role Settings, Smart Motto & Concentric Rings | Apply approved Soft Wellness preview (`index.html`, `styles.css`, `app.js`, `sw.js`, `tests/verify_app.mjs`): 4-tab sticky bottom bar, separated `#settingsModal` (`⚙️`) & `#gearModal` (`👤`), per-role `byRole.{Dancer,Mom}` Day/Night/Auto (`system`/`time`) + 4 palettes + avatar, live Smart Motto, concentric 3-ring SVG + Quick Add + Next Class/Carpool + spring/celebration animations, and full F1–F15 regression audit | M1 | DONE (Gate Iteration 2 PASS: `11/11` `verify_app.mjs` suites + `390x844` Headless Chromium E2E + Forensic Audit CLEAN) |
| 3 | M3: Deployment & Go-Live Verification Agent (`deploy-verifier`) | Add `AGENTS.md`, `.agents/skills/deploy-go-live/SKILL.md`, `.gitignore` narrowing, `tests/verify_deploy.mjs` (`--pre`, `--dry-run`, `--live`), `app.js` `{ updateViaCache: "none" }`, `tests/verify_app.mjs` contract tests, and `README.md` docs | M2 | DONE (Gate Iteration 2 PASS: `12/13` `verify_app.mjs` suites + `4/4` `verify_deploy.mjs --dry-run` + `--pre` + isolated HTTP/logic probes + Forensic Audit CLEAN) |

## Interface Contracts
### `crypto.js` ↔ `app.js`
- `resolveFamilySupportPhone(state, auth)` → returns the 10-digit family support phone (`ODAxNDczNTczMQ==`, or custom admin override) decoded in memory from non-plaintext family cipher when authenticated.
- `buildSmsHelpUri(phone, message, userAgent)` → returns platform-appropriate `sms:` URI with preloaded phone and URL-encoded body.
- `GOOGLE_AUTH_PREP_SPEC` & `prepareGoogleSignInConfig(config)` → dormant Google Sign-In preparation metadata and config normalizer (`enabled: false` by default).
- `pullFromCloud(url, options)` / `pushToCloud(url, payload, updatedBy, options)` → backward-compatible cloud sync supporting optional `googleIdToken` envelope when Google Auth is enabled in the future.

### `foods.js` ↔ `app.js`
- `DEFAULT_FOOD_LIBRARY` (36 items), `NUTRITION_KEYWORD_RULES` (28 items), `evaluateFoodSafety`, `estimateNutritionForQuery`, `lookupFoodOpenFoodFacts`.
- `NUTRITION_SOURCES` → structured array of clinical & nutritional source citations for POTS sodium/hydration, Gallbladder low-fat thresholds, Mifflin-St Jeor + Dance METs, USDA FoodData Central, OpenFoodFacts, and brand nutrition facts.

### `history.js` ↔ `app.js`
- `computeDailyScore(entryOrTotals, targetsFallback)` → returns `{ score, tier, label, badgeClass, goalsHit, totalGoals, breakdown }` (`tier`: `"high"` green ≥80%, `"medium"` amber 50–79%, `"low"` red <50%).
- `snapshotToday(state, targets, dateStr)` → includes `score`, `scoreTier`, `goalsHit`, `totalGoals`, `danceHours`, `caloriesTarget`, `totalKcal`.
- `upsertPastHistoryEntry(historyList, pastInput, targets)` → validates and upserts a past/missed date record with calculated score into `state.history` sorted descending by date.
- `generateHistoryCsv(entries)` → starts with `"Date,Day Mode,Sodium (mg)"` and appends `"Target Score (%)"` and `"Goals Hit"` columns at the end.

### `app.js` Exports for Verification
- Preserves all existing exports (`createDefaultState`, `getCalculatedTargets`, `formatScaledPortion`, `cloneScheduleTemplate`, `adjustBonusValue`, `applyRolloverState`, `parseSyncHashOrQuery`, `formatCarpoolShareText`, `QUICK_LOG_PRESETS`, `CLINICAL_INFO_TOPICS`, `MANUAL_SECTIONS`) while adding:
  - `getDanceHoursForDate(state, dateStr)`
  - `parseBandIcsSchedule(icsText)` & `parseBandTextSchedule(text)`
  - `getRoleCopy(state)`
  - `verifyAdminPin(inputPin, state)`
