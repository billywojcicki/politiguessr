/**
 * enrich-locations.ts
 * Adds a `town` field to each entry in data/locations.json via reverse geocoding.
 *
 * Picks the most specific named locality from the Google Geocoding API response:
 *   locality → sublocality_level_1 → administrative_area_level_3 → (omitted)
 *
 * Safe to re-run — skips entries that already have a `town` field.
 *
 * Usage:
 *   npx tsx scripts/enrich-locations.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const OUT_PATH = path.join(DATA_DIR, "locations.json");

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
  town?: string | null;
}

interface GeocodeResult {
  address_components: Array<{
    long_name: string;
    types: string[];
  }>;
}

interface GeocodeResponse {
  status: string;
  results: GeocodeResult[];
}

function extractTown(result: GeocodeResult): string | null {
  const priority = [
    "locality",
    "sublocality_level_1",
    "administrative_area_level_3",
  ];
  for (const type of priority) {
    const component = result.address_components.find((c) => c.types.includes(type));
    if (component) return component.long_name;
  }
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`;
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data) as GeocodeResponse;
            if (json.status !== "OK" || json.results.length === 0) {
              resolve(null);
              return;
            }
            resolve(extractTown(json.results[0]));
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

async function main() {
  if (!API_KEY) {
    console.error("No GOOGLE_MAPS_API_KEY found. Add it to .env.local or set the env var.");
    process.exit(1);
  }

  if (!fs.existsSync(OUT_PATH)) {
    console.error("locations.json not found at", OUT_PATH);
    process.exit(1);
  }

  const locations: Location[] = JSON.parse(fs.readFileSync(OUT_PATH, "utf-8"));
  // Skip entries that already have a town name; retry ones that got null (API may have failed)
  const toEnrich = locations.filter((l) => !l.town);

  console.log(`${locations.length} total locations, ${toEnrich.length} need geocoding.`);

  if (toEnrich.length === 0) {
    console.log("All locations already have town names. Nothing to do.");
    return;
  }

  let done = 0;
  let found = 0;

  for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
    const batch = toEnrich.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (loc) => {
        loc.town = await reverseGeocode(loc.lat, loc.lng);
      })
    );

    done += batch.length;
    found += batch.filter((l) => l.town).length;

    fs.writeFileSync(OUT_PATH, JSON.stringify(locations, null, 2));

    const pct = Math.round((done / toEnrich.length) * 100);
    process.stdout.write(
      `\r[${done}/${toEnrich.length}] ${pct}%  towns found: ${found}/${done}  `
    );
  }

  console.log(`\n\nDone! ${found}/${toEnrich.length} locations have a town name.`);
  console.log(`${toEnrich.length - found} had no identifiable locality (likely rural).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
