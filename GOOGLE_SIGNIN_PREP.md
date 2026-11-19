# Future Google Sign-In Architecture Prep (`GOOGLE_SIGNIN_PREP.md`)

This document records all dormant Google Identity Services (GIS) / Google Sign-In preparation hooks added in Milestone M1 (Requirement 2c) so that when you bring up Google Sign-In in a future update, everything is already wired and ready to activate without restructuring the app.

---

## 1. Current Status: Prepped & Dormant (`enabled: false`)

- **Default Behavior Today**: The app continues to use the simple **Family PIN** unlock (`#pinOverlay`) and **Admin PIN** (`#adminModal`) with zero Google login prompts shown to regular users.
- **Dormant Flag**: `state.adminConfig.googleAuth.enabled` is strictly `false` by default (`prepareGoogleSignInConfig` in `crypto.js`).

---

## 2. Exact Code Hooks Added Across the Repository

### A. `crypto.js`
1. **`GOOGLE_AUTH_PREP_SPEC` (Exported Constant)**:
   - Defines the protocol specification:
     - `version`: `"1.0.0-prep"`
     - `status`: `"dormant"`
     - `provider`: `"google_gis"`
     - `gisScriptUrl`: `"https://accounts.google.com/gsi/client"`
     - `tokenVerificationEndpoint`: `"https://oauth2.googleapis.com/tokeninfo"`
     - `envelopeField`: `"auth"`
     - `defaultConfig`: `{ enabled: false, clientId: "", allowedEmails: [], requireGoogleForSync: false, lastSignedInEmail: "", idToken: "" }`
2. **`prepareGoogleSignInConfig(rawConfig)` (Exported Helper)**:
   - Normalizes `clientId`, `allowedEmails` (array or comma-separated string of family Gmail addresses), `requireGoogleForSync`, `lastSignedInEmail`, and `idToken`.
   - Safeguard: `enabled` only evaluates to `true` when both `rawConfig.enabled === true` AND a non-empty `clientId` is configured.
3. **Cloud Sync Auth Envelope in `pullFromCloud(url, options)` & `pushToCloud(url, payload, updatedBy, options)`**:
   - In `pushToCloud`: When `options.googleIdToken` is passed, the JSON POST body automatically includes:
     ```json
     {
       "updatedAt": "2026-11-19T...",
       "updatedBy": "Dancer",
       "payload": "EPSTEADY-AES256:...",
       "auth": {
         "provider": "google_gis",
         "idToken": "<Google_JWT_ID_Token>",
         "email": "family@gmail.com"
       }
     }
     ```
     while preserving `Content-Type: text/plain;charset=utf-8` so Google Apps Script Web Apps never fail CORS preflight checks.
   - In `pullFromCloud`: When `options.googleIdToken` is passed, appends `&id_token=<encoded_jwt>` to the GET query string.

### B. `app.js`
1. **`state.adminConfig.googleAuth`**:
   - Initialized in `createDefaultState()` and preserved in `mergeState()` via `prepareGoogleSignInConfig()`.
2. **Cloud Push / Pull Integration**:
   - `silentPushToCloud()` and `silentPullFromCloud()` check `state.adminConfig?.googleAuth`: when `enabled && idToken`, they automatically pass `{ googleIdToken, email }` to `pushToCloud` and `pullFromCloud`.
3. **Admin Dashboard Controls**:
   - Inside the PIN-secured **Admin Dashboard** (`#adminModal` -> `#adminGoogleAuthSection`), the Admin can pre-fill:
     - **Google OAuth 2.0 Web Client ID** (`#adminGoogleClientIdInput`)
     - **Allowed Family Google Emails** (`#adminGoogleEmailsInput`)

### C. `index.html`
1. **Dormant Mount Point on Unlock Screen**:
   - `<div id="googleSignInMount" class="hidden" data-google-signin-prep="ready"></div>` inside `#pinOverlay` is ready to render the official Google `"Sign in with Google"` button when enabled.
2. **Admin Configuration Section**:
   - `#adminGoogleAuthSection` inside `#adminModal` displays the prepped configuration fields and status badge (`Status: Prepped & Dormant (PIN Auth Active)`).

---

## 3. Future Activation Checklist (When You Are Ready to Deploy Google Sign-In)

When you bring this topic back up in a future update, activating Google Sign-In requires only 3 small steps:

1. **Create a Google Cloud OAuth 2.0 Web Client ID**:
   - In Google Cloud Console → *APIs & Services → Credentials*, create an **OAuth 2.0 Client ID (Web Application)** and add your GitHub Pages origin (`https://jayray801.github.io`) to **Authorized JavaScript origins**.
2. **Enable the GIS Client Loader on `#googleSignInMount`**:
   - Dynamically load `GOOGLE_AUTH_PREP_SPEC.gisScriptUrl` (`https://accounts.google.com/gsi/client`), call `google.accounts.id.initialize({ client_id, callback })`, and render the button into `#googleSignInMount` when `state.adminConfig.googleAuth.enabled === true`.
3. **(Optional) Verify `auth.idToken` in Google Apps Script (`doPost` / `doGet`)**:
   - In your Apps Script backend, verify `body.auth.idToken` against `https://oauth2.googleapis.com/tokeninfo?id_token=...` and check that the verified `email` is in your family's `allowedEmails` list.
