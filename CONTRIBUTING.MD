# Contributing

This repo is **frontend only**. The deployed API at `https://fleetmanager-wyt3.onrender.com` is the source of truth for data.

## Before You Start
1. Read `docs/KB.md`.
2. Confirm target endpoints exist (curl or browser). If not, open an issue instead of coding around it.
3. Ensure `.env` has:
   - `VITE_API_BASE_URL` (no trailing slash)
   - `VITE_MAPBOX_TOKEN`

## Pre-flight Checklist (must pass)
- [ ] I searched for an existing component/hook and will extend it (no duplicates).
- [ ] My calls are **org-scoped** and send `Authorization: Bearer`.
- [ ] I used the shared API client (`src/lib/api.ts`) and/or `use-auth` store.
- [ ] I handle `401` by logging out and redirecting to `/login`.
- [ ] I avoided building UI that depends on non-MVP endpoints; I disabled with a tooltip if needed.
- [ ] I used `FormData` for document uploads.
- [ ] A11y: labels, keyboard focus, visible focus ring.

## Definition of Done
- PR references the relevant section(s) in `docs/KB.md`.
- Local manual check: login → /app/vehicles list/create → positions “send test” (optional) → documents list.
- No `//api` double-slash requests; no console errors.
- No backend files added/modified.

## Quick Smoke (curl)
- Use `mvp_smoke.sh` (in repo root) to validate auth/vehicles/positions/trips/documents against the deployed API.
