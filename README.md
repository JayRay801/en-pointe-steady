# En Pointe & Steady

A privacy-first, mobile-first Progressive Web App (PWA) for POTS and gallbladder-safe dance fueling, hydration tracking, carpool coordination, and encrypted Google Sheets synchronization.

## Features

- **Today View**: Daily fuel timeline, sodium/hydration targets, and a 7-day wellness overview.
- **Food Library & Analyzer**: Curated POTS & gallbladder-safe food catalog (`<= 5.5g` fat per meal cap) with nutrition lookup and meal planning.
- **Carpool & Schedule**: Studio carpool coordination and schedule day-mode tracking.
- **Historical Tracker**: 7-day, 30-day, and all-time wellness history, symptom correlation, CSV export, and 1-tap Print/PDF Doctor Report.
- **Zero-PII Encrypted Sync**: Client-side WebCrypto PBKDF2 + AES-256-GCM encryption (`EPSTEADY-AES256:...`) with optional Google Apps Script + Google Sheets (`Cloud_Sync_Store`) synchronization and remember-device PIN lock.

## Architecture

- Static PWA (`index.html`, `styles.css`, `app.js`, `crypto.js`, `foods.js`, `history.js`, `manifest.webmanifest`, `sw.js`) hosted on GitHub Pages.
- All personal profile, schedule, carpool, and health history data remain encrypted at rest and never reside in this public repository.

## Verification

```bash
node tests/verify_app.mjs
```
