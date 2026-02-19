/**
 * curate-locations.ts
 * Generates 500 valid Street View locations across US counties.
 *
 * Strategy:
 *   - For each county, weight selection probability by totalVotes (proxy for population)
 *   - Generate random points inside the county bounding box, check point-in-polygon
 *   - Verify Google Street View Metadata API returns status "OK"
 *   - Store: lat, lng, fips, heading
 *
 * Usage:
 *   npx tsx scripts/curate-locations.ts
 *
 * Optional env vars:
 *   TARGET=500          number of valid locations to collect
 *   CONCURRENCY=10      parallel Street View API requests
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as turf from "@turf/turf";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const TARGET = parseInt(process.env.TARGET ?? "500");
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "10");
const API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? loadApiKey();

function loadApiKey(): string {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const [k, v] = line.split("=");
      if (k?.trim() === "GOOGLE_MAPS_API_KEY") return v?.trim() ?? "";
    }
  }
  return "";
}

interface Location {
  lat: number;
  lng: number;
  fips: string;
  heading: number;
}

interface CountyFeature extends GeoJSON.Feature<GeoJSON.Geometry> {
  properties: {
    fips: string;
    county: string;
    state: string;
    stateAbbr: string;
    totalVotes: number;
    margin: number;
    demPct: number;
    gopPct: number;
  };
}

async function checkStreetView(lat: number, lng: number): Promise<boolean> {
  return new Promise((resolve) => {
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${API_KEY}`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.status === "OK");
          } catch {
            resolve(false);
          }
        });
      })
      .on("error", () => resolve(false));
  });
}

function randomPointInFeature(feature: CountyFeature): [number, number] | null {
  // Use turf's bounding box and rejection sampling
  const bbox = turf.bbox(feature);
  const [minLng, minLat, maxLng, maxLat] = bbox;

  for (let attempt = 0; attempt < 50; attempt++) {
    const lat = minLat + Math.random() * (maxLat - minLat);
    const lng = minLng + Math.random() * (maxLng - minLng);
    const pt = turf.point([lng, lat]);

    try {
      if (turf.booleanPointInPolygon(pt, feature as turf.Feature<turf.Polygon | turf.MultiPolygon>)) {
        return [lat, lng];
      }
    } catch {
      // Some features may have issues; skip
    }
  }
  return null;
}

function weightedSample<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function renderProgressBar(current: number, total: number, width = 40): string {
  const pct = current / total;
  const filled = Math.round(pct * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return `[${bar}] ${current}/${total} (${Math.round(pct * 100)}%)`;
}

async function processBatch(
  candidates: Array<{ feature: CountyFeature; lat: number; lng: number; heading: number }>
): Promise<Location[]> {
  const results = await Promise.all(
    candidates.map(async ({ feature, lat, lng, heading }) => {
      const valid = await checkStreetView(lat, lng);
      if (valid) {
        return {
          lat,
          lng,
          fips: feature.properties.fips,
          heading,
        } as Location;
      }
      return null;
    })
  );
  return results.filter((r): r is Location => r !== null);
}

async function main() {
  if (!API_KEY) {
    console.error("No GOOGLE_MAPS_API_KEY found. Add it to .env.local.");
    process.exit(1);
  }

  // Load GeoJSON
  const geojsonPath = path.join(DATA_DIR, "counties.geojson");
  if (!fs.existsSync(geojsonPath)) {
    console.error("counties.geojson not found. Run: npm run process-data");
    process.exit(1);
  }

  console.log("Loading counties.geojson...");
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf-8")) as GeoJSON.FeatureCollection;

  // Filter to contiguous US + Alaska + Hawaii (exclude territories with fips > 56xxx)
  const EXCLUDED_FIPS_PREFIXES = ["60", "66", "69", "72", "78"]; // territories
  const counties = geojson.features.filter((f) => {
    const fips = (f.properties as CountyFeature["properties"]).fips;
    return (
      !EXCLUDED_FIPS_PREFIXES.some((p) => fips.startsWith(p)) &&
      (f.properties as CountyFeature["properties"]).totalVotes > 0
    );
  }) as CountyFeature[];

  console.log(`  ${counties.length} counties eligible`);

  const weights = counties.map((c) => Math.sqrt(c.properties.totalVotes + 1));

  const locations: Location[] = [];

  // Load existing locations if resuming
  const outPath = path.join(DATA_DIR, "locations.json");
  if (fs.existsSync(outPath)) {
    const existing = JSON.parse(fs.readFileSync(outPath, "utf-8")) as Location[];
    locations.push(...existing);
    console.log(`  Resuming from ${locations.length} existing locations`);
  }

  let attempts = 0;
  let apiCalls = 0;

  console.log(`\nCollecting ${TARGET} valid Street View locations (concurrency=${CONCURRENCY})...\n`);

  while (locations.length < TARGET) {
    // Build a batch of candidates
    const batch: Array<{ feature: CountyFeature; lat: number; lng: number; heading: number }> = [];

    for (let i = 0; i < CONCURRENCY * 3; i++) {
      const feature = weightedSample(counties, weights);
      const pt = randomPointInFeature(feature);
      if (pt) {
        const [lat, lng] = pt;
        const heading = Math.floor(Math.random() * 360);
        batch.push({ feature, lat, lng, heading });
        attempts++;
      }
    }

    apiCalls += batch.length;
    const found = await processBatch(batch);
    locations.push(...found);

    // Save incrementally
    fs.writeFileSync(outPath, JSON.stringify(locations, null, 2));

    // Progress
    process.stdout.write(
      `\r${renderProgressBar(locations.length, TARGET)}  attempts=${attempts} api_calls=${apiCalls} hit_rate=${((locations.length / apiCalls) * 100).toFixed(1)}%  `
    );

    if (locations.length >= TARGET) break;
  }

  console.log(`\n\nDone! ${locations.length} locations saved to ${outPath}`);
  console.log(`Total attempts: ${attempts}, API calls: ${apiCalls}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
