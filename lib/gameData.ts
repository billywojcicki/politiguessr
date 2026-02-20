/**
 * Loads static game data (election results + curated locations).
 * Uses a module-level singleton so data is only read once per server process.
 */

import * as fs from "fs";
import * as path from "path";
import type { ElectionResult, Location } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

let electionData: Record<string, ElectionResult> | null = null;
let locations: Location[] | null = null;

export function getElectionData(): Record<string, ElectionResult> {
  if (!electionData) {
    const p = path.join(DATA_DIR, "election-results.json");
    electionData = JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  return electionData!;
}

export function getLocations(): Location[] {
  if (!locations) {
    const p = path.join(DATA_DIR, "locations.json");
    locations = JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  return locations!;
}

export function pickRandomLocations(count: number): Location[] {
  const all = getLocations();
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Returns the same 5 locations for every server given the same dateStr (YYYY-MM-DD). */
export function getDailyLocations(dateStr: string): Location[] {
  const [y, m, d] = dateStr.split("-").map(Number);
  let seed = y * 10000 + m * 100 + d;
  const rand = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const locs = [...getLocations()];
  for (let i = locs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [locs[i], locs[j]] = [locs[j], locs[i]];
  }
  return locs.slice(0, 5);
}

export function getStreetViewUrl(lat: number, lng: number, heading: number): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  return (
    `https://maps.googleapis.com/maps/api/streetview` +
    `?size=640x400&location=${lat},${lng}&heading=${heading}&pitch=0&fov=90&key=${key}`
  );
}
