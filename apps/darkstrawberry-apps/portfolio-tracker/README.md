# Portfolio Tracker

Live portfolio tracker for Duong + one friend. Vue 3 SPA backed by Firebase.

**Plan:** `plans/approved/2026-04-19-portfolio-tracker.md` (ADR)
**Tasks:** `plans/approved/2026-04-19-portfolio-tracker-v0-tasks.md`

## Development

```bash
npm install
npm run dev          # Vite dev server → localhost:5173
```

## Emulators

```bash
firebase emulators:start --only auth,firestore,functions
```

Set `VITE_USE_FIREBASE_EMULATOR=true` in `.env.local` to connect the app to local emulators.

## v0 scope

CSV-only skeleton: Firebase project, Auth + allowlist, Firestore schema,
CSV import, dashboard shell. No broker APIs.
