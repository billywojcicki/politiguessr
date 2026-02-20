# PolitiGuessr

## Project Overview
A web game where players see an interactive Google Street View of a random US location and guess how the county voted (D+X to R+X) in the 2024 presidential election. Think GeoGuessr but for political leanings. County is the unit of play (3,143 counties, standardized nationwide).

## Tech Stack
- Next.js 14.2.5 (App Router) — Node 18, no src/ dir
- React 18, TypeScript, Tailwind CSS
- Fonts: Space Grotesk + Space Mono (loaded via next/font/google)
- Google Maps JS API (interactive Street View panorama)
- Turf.js (point-in-polygon, used in data scripts only)
- Supabase — auth (email OTP), game history DB, rate limiting

## Key Files & Directories
- `data/election-results.json` — county FIPS → election data (generated, do not edit)
- `data/counties.geojson` — Census county boundaries + election data merged (generated, 25MB, committed to git)
- `data/locations.json` — 500 curated Street View locations, pre-validated, includes `town` field from reverse geocoding (generated, **do not regenerate unless adding more**)
- `scripts/process-data.ts` — parses CSV + shapefile → generates data/
- `scripts/curate-locations.ts` — hits Street View Metadata API to build locations.json
- `scripts/enrich-locations.ts` — reverse geocodes each location to add `town` field (safe to re-run, skips already-enriched)
- `lib/supabase.ts` — browser Supabase client singleton
- `lib/supabaseServer.ts` — server-side Supabase client (uses service role key, API routes only)
- `lib/gameLimits.ts` — client-side limit checking (localStorage/sessionStorage, no DB calls — fast UX gate only)
- `lib/sessionToken.ts` — HMAC session signing
- `2024_results.csv`, `cb_2023_us_county_500k.*` — raw source data in project root (git-ignored)

## Data Pipeline Status
**Already run — do not re-run unless explicitly asked.**
- `data/election-results.json` ✓
- `data/counties.geojson` ✓
- `data/locations.json` ✓ (500 locations, ~18% Street View hit rate, 479/500 have town names)

To add more locations: `TARGET=1000 npm run curate-locations` (resumes from existing file)
To enrich town names: `npm run enrich-locations` (skips already-enriched, retries nulls)

## Architecture
- Game is fully client-side except for API routes:
  - `GET /api/game` — enforces rate limits server-side, returns `sessionToken` (HMAC-signed) + 5 random rounds + user `tier`. Requires `Authorization: Bearer <token>` header for signed-in users.
  - `POST /api/guess` — accepts `sessionToken` + guess, verifies HMAC signature, returns fips, county, state, town, actual margin, score
  - `GET /api/county-map?fips=XXXXX` — returns SVG of state with county highlighted red/blue
- Sessions are **stateless**: answers are HMAC-signed into the token using `SESSION_SECRET`. See `lib/sessionToken.ts`.
- All game UI in `components/Game.tsx` — single component, phases: loading → playing → reveal → done → **limited**
- `GuessResult` includes `fips` so client can fetch county map SVG after reveal

## Auth & Accounts
- Auth via Supabase email + password — `components/AuthModal.tsx`
- Auth is **optional** — anonymous play is fully supported
- Modal has three modes: **Sign In**, **Create Account**, **Forgot Password** (sends reset link)
- Email confirmation is **disabled** in Supabase — signups are immediately active
- User tier stored in `profiles` table (`free` | `pro`). Pro is placeholder — no payment integration yet.
- A Postgres trigger auto-creates a `profiles` row on every new user signup.
- To manually grant Pro: `update profiles set tier = 'pro' where id = (select id from auth.users where email = 'x@y.com');`

## Game Limits
- **Anonymous**: 3 games/day — tracked client-side (localStorage) + server-side (IP hash in `anon_rate_limits` table)
- **Free (signed in)**: 6 games/day — tracked client-side (sessionStorage count) + server-side (JWT verify + `games` table count)
- **Pro**: unlimited — checked via `profiles.tier`
- Client-side check is a fast UX gate (no DB). Server-side in `/api/game` is the real enforcement.
- IP is hashed with `SESSION_SECRET` before storage — raw IPs never stored.
- Atomic DB increment via `check_and_increment_anon()` Postgres RPC function.
- If rate limit RPC fails (e.g. not yet set up), server fails open (allows game) to avoid blocking users.

## Database (Supabase)
Tables:
- `games` — `id, user_id, total_score, rounds (jsonb), played_at` — RLS: insert own, select all
- `profiles` — `id, tier ('free'|'pro'), created_at` — RLS: select own only
- `anon_rate_limits` — `ip_hash, game_date, count` — no RLS (server-side only via service role)

`rounds` JSONB shape: `[{ roundNumber, fips, county, state, town, actualMargin, guessedMargin, score, timedOut }]`

Scores are saved client-side to Supabase at end of game if user is logged in. If user logs in on the done screen, save triggers automatically.

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
- `NEXT_PUBLIC_SUPABASE_URL` — e.g. `https://xxxx.supabase.co` (set in Vercel dashboard)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key (set in Vercel dashboard)
- `SUPABASE_SERVICE_ROLE_KEY` — secret service role key, server-side only, never expose client-side (set in Vercel dashboard)
- Never commit .env.local

## Conventions
- TypeScript everywhere; scripts excluded from Next.js tsconfig (have own tsx config)
- Tailwind for all styling, no separate CSS files
- Components in /components, game logic in /lib, API routes in /app/api/
- `RESTRICT_NAVIGATION = false` in StreetViewPanorama.tsx — flip to true to re-enable anti-cheat (hides address, disables walking)
- Design: editorial/monospace aesthetic — black bg, Space Grotesk/Mono, sharp borders, red/blue only for partisan data
