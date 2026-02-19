# PolitiGuessr

## Project Overview
A web game where players see an interactive Google Street View of a random US location and guess how the county voted (D+X to R+X) in the 2024 presidential election. Think GeoGuessr but for political leanings. County is the unit of play (3,143 counties, standardized nationwide).

## Tech Stack
- Next.js 14.2.5 (App Router) — Node 18, no src/ dir
- React 18, TypeScript, Tailwind CSS
- Fonts: Space Grotesk + Space Mono (loaded via next/font/google)
- Google Maps JS API (interactive Street View panorama)
- Turf.js (point-in-polygon, used in data scripts only)
- Supabase — planned for auth/leaderboards, not yet set up

## Key Files & Directories
- `data/election-results.json` — county FIPS → election data (generated, do not edit)
- `data/counties.geojson` — Census county boundaries + election data merged (generated, 25MB, committed to git)
- `data/locations.json` — 500 curated Street View locations, pre-validated (generated, **do not regenerate unless adding more**)
- `scripts/process-data.ts` — parses CSV + shapefile → generates data/
- `scripts/curate-locations.ts` — hits Street View Metadata API to build locations.json
- `2024_results.csv`, `cb_2023_us_county_500k.*` — raw source data in project root (git-ignored)

## Data Pipeline Status
**Already run — do not re-run unless explicitly asked.**
- `data/election-results.json` ✓
- `data/counties.geojson` ✓
- `data/locations.json` ✓ (500 locations, ~18% Street View hit rate)

To add more locations: `TARGET=1000 npm run curate-locations` (resumes from existing file)

## Architecture
- Game is fully client-side except for API routes:
  - `GET /api/game` — returns `sessionToken` (HMAC-signed) + 5 random rounds (Street View URL, lat/lng/heading). Answers encoded in the signed token, no server-side state.
  - `POST /api/guess` — accepts `sessionToken` + guess, verifies HMAC signature, returns fips, county, state, actual margin, score
  - `GET /api/county-map?fips=XXXXX` — returns SVG of state with county highlighted red/blue
- Sessions are **stateless**: answers are HMAC-signed into the token using `SESSION_SECRET`. See `lib/sessionToken.ts`.
- All game UI in `components/Game.tsx` — single component, phases: loading → playing → reveal → done
- `GuessResult` includes `fips` so client can fetch county map SVG after reveal

## Game Design
- Slider range: D+50 to R+50 (note: some counties exceed this in reality)
- Scoring: `max(0, round(100 - |actual - guess|))` per round, 5 rounds, max 500 pts
- End game screen has per-round REVIEW button — opens full-screen Street View for that location
- DEV mode toggle (top-right during game) pauses both the round timer and auto-advance timer

## Deployment
- Deployed on Vercel (free/Hobby plan) — auto-deploys on push to `master`
- Pushing to any other branch (e.g. `dev`) creates a Vercel preview deployment at a unique URL
- Recommended workflow: develop on `dev`, test via preview URL, merge to `master` to ship
- `next.config.mjs` has `outputFileTracingIncludes` to ensure data files are bundled into serverless functions

## Environment Variables
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — client-side Street View JS API (set in Vercel dashboard)
- `GOOGLE_MAPS_API_KEY` — local scripts only, not needed on Vercel
- `SESSION_SECRET` — random 32+ char secret for HMAC session signing (set in Vercel dashboard)
- Never commit .env.local

## Conventions
- TypeScript everywhere; scripts excluded from Next.js tsconfig (have own tsx config)
- Tailwind for all styling, no separate CSS files
- Components in /components, game logic in /lib, API routes in /app/api/
- `RESTRICT_NAVIGATION = false` in StreetViewPanorama.tsx — flip to true to re-enable anti-cheat (hides address, disables walking)
- Design: editorial/monospace aesthetic — black bg, Space Grotesk/Mono, sharp borders, red/blue only for partisan data
