/**
 * process-data.ts
 * Parses 2024_results.csv and shapefiles, outputs:
 *   data/election-results.json  — county FIPS → election data
 *   data/counties.geojson       — GeoJSON FeatureCollection with FIPS + election data merged in
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import * as shapefile from "shapefile";

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

interface ElectionResult {
  fips: string;
  county: string;
  state: string;
  totalVotes: number;
  demVotes: number;
  gopVotes: number;
  demPct: number;
  gopPct: number;
  /** R% - D%, positive = red, negative = blue */
  margin: number;
}

async function parseElectionCSV(): Promise<Map<string, ElectionResult>> {
  console.log("Parsing 2024_results.csv...");
  const csvPath = path.join(ROOT, "2024_results.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");

  const records = parse(raw, { columns: true, skip_empty_lines: true }) as Array<{
    state_name: string;
    county_fips: string;
    county_name: string;
    votes_gop: string;
    votes_dem: string;
    total_votes: string;
    diff: string;
    per_gop: string;
    per_dem: string;
    per_point_diff: string;
  }>;

  const map = new Map<string, ElectionResult>();
  for (const r of records) {
    const fips = r.county_fips.padStart(5, "0");
    const gopPct = parseFloat(r.per_gop);
    const demPct = parseFloat(r.per_dem);
    map.set(fips, {
      fips,
      county: r.county_name,
      state: r.state_name,
      totalVotes: parseInt(r.total_votes),
      demVotes: parseInt(r.votes_dem),
      gopVotes: parseInt(r.votes_gop),
      demPct,
      gopPct,
      margin: Math.round((gopPct - demPct) * 1000) / 10, // R - D in percentage points, 1 decimal
    });
  }

  console.log(`  Parsed ${map.size} counties`);
  return map;
}

async function convertShapefile(
  electionData: Map<string, ElectionResult>
): Promise<void> {
  console.log("Converting shapefile to GeoJSON...");
  const shpPath = path.join(ROOT, "cb_2023_us_county_500k.shp");

  const source = await shapefile.open(shpPath);
  const features: GeoJSON.Feature[] = [];

  let result = await source.read();
  while (!result.done) {
    const feature = result.value as GeoJSON.Feature;
    const props = feature.properties as Record<string, unknown>;

    // GEOID is the 5-digit FIPS code in the Census shapefile
    const fips = (props.GEOID as string)?.padStart(5, "0") ?? "";
    const election = electionData.get(fips);

    if (election) {
      feature.properties = {
        fips,
        county: election.county,
        state: election.state,
        totalVotes: election.totalVotes,
        demPct: election.demPct,
        gopPct: election.gopPct,
        margin: election.margin,
        // Keep Census name for reference
        name: props.NAME,
        stateAbbr: props.STUSPS,
      };
    } else {
      // Keep it in GeoJSON but without election data (Alaska, etc.)
      feature.properties = {
        fips,
        name: props.NAME,
        stateAbbr: props.STUSPS,
        county: props.NAME,
        state: props.STATE_NAME ?? "",
        totalVotes: 0,
        demPct: 0,
        gopPct: 0,
        margin: 0,
      };
    }

    features.push(feature);
    result = await source.read();
  }

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  const outPath = path.join(DATA_DIR, "counties.geojson");
  fs.writeFileSync(outPath, JSON.stringify(geojson));
  console.log(`  Written ${features.length} features → ${outPath}`);
}

async function writeElectionJSON(electionData: Map<string, ElectionResult>): Promise<void> {
  const obj: Record<string, ElectionResult> = {};
  for (const [fips, data] of electionData) {
    obj[fips] = data;
  }
  const outPath = path.join(DATA_DIR, "election-results.json");
  fs.writeFileSync(outPath, JSON.stringify(obj));
  console.log(`  Written election data → ${outPath}`);
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const electionData = await parseElectionCSV();
  await writeElectionJSON(electionData);
  await convertShapefile(electionData);

  console.log("\nDone! Run scripts/curate-locations.ts next.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
