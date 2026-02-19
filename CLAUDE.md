# PolitiGuessr

## Project Overview
A web game where players see a Google Street View image of a random US location and guess whether the county voted red or blue (and by how much) in the 2024 presidential election. Think GeoGuessr but for political leanings.

## Tech Stack
- Next.js 14+ (App Router)
- React
- Supabase (auth + database, set up later)
- Tailwind CSS
- Turf.js (point-in-polygon geo lookups)
- Google Street View Static API

## Key Files
- `2024_results.csv` — County-level 2024 presidential election results (from tonmcg/GitHub)
- `cb_2023_us_county_500k.*` — Census TIGER county boundary shapefiles

## API Keys
- Google Maps API keys are in .env.local (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and GOOGLE_MAPS_API_KEY)
- Never commit .env.local

## Conventions
- Use TypeScript
- Use Tailwind for styling, no separate CSS files
- Keep components in /components, game logic in /lib
- API routes in /app/api/