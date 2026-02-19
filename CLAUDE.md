# PolitiGuessr

## Project Overview
A web game where players see an interactive Google Street View of a random US location and guess how the county voted (D+X to R+X) in the 2024 presidential election. Think GeoGuessr but for political leanings.

## Tech Stack
- Next.js 14.2.5 (App Router) — Node 18, no src/ dir
- React 18, TypeScript, Tailwind CSS
- Google Maps JS API (interactive Street View panorama)
- Turf.js (point-in-polygon, used in data scripts only)
- Supabase — planned for auth/leaderboards, not yet set up

## Key Files & Directories
- `data/election-results.json` — county FIPS → election data (generated, do not edit)
- `data/counties.geojson` — Census county boundaries + election data merged (generated, 25MB)
- `data/locations.json` — 500 curated Street View locations, pre-validated (generated, **do not regenerate unless adding more**)
- `scripts/process-data.ts` — parses CSV + shapefile → generates data/
- `scripts/curate-locations.ts` — hits Street View Metadata API to build locations.json
- `2024_results.csv`, `cb_2023_us_county_500k.*` — raw source data in project root

## Data Pipeline Status
**Already run — do not re-run unless explicitly asked.**
- `data/election-results.json` ✓
- `data/counties.geojson` ✓
- `data/locations.json` ✓ (500 locations, ~18% Street View hit rate)

To add more locations: `TARGET=1000 npm run curate-locations` (resumes from existing file)

## Architecture
- Game is fully client-side except for two API routes:
  - `GET /api/game` — returns sessionId + 5 random rounds (Street View URL, lat/lng/heading). Answers kept server-side in `globalThis` session store.
  - `POST /api/guess` — accepts guess, returns county name, actual margin, score
  - `GET /api/county-map?fips=XXXXX` — returns SVG of state with county highlighted
- Session store uses `globalThis` to survive Next.js HMR reloads
- All game UI in `components/Game.tsx` — single component, phases: loading → playing → reveal → done

## API Keys
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — used client-side for Street View JS API
- `GOOGLE_MAPS_API_KEY` — used server-side / in scripts
- Never commit .env.local

## Conventions
- TypeScript everywhere; scripts excluded from Next.js tsconfig (have own tsx config)
- Tailwind for all styling, no separate CSS files
- Components in /components, game logic in /lib, API routes in /app/api/
- `RESTRICT_NAVIGATION = false` in StreetViewPanorama.tsx — flip to true to re-enable anti-cheat
