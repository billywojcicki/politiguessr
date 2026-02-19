import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { pickRandomLocations, getElectionData, getStreetViewUrl } from "@/lib/gameData";
import { createToken } from "@/lib/sessionToken";
import type { RoundPublic, GameSession } from "@/lib/types";

const ROUNDS_PER_GAME = 5;

export async function GET() {
  try {
    const locs = pickRandomLocations(ROUNDS_PER_GAME);
    const election = getElectionData();

    const secretRounds = locs.map((loc, i) => {
      const result = election[loc.fips];
      return {
        roundNumber: i + 1,
        fips: loc.fips,
        county: result?.county ?? "Unknown County",
        state: result?.state ?? "Unknown",
        margin: result?.margin ?? 0,
      };
    });

    const sessionToken = createToken(secretRounds);

    const publicRounds: RoundPublic[] = locs.map((loc, i) => ({
      roundNumber: i + 1,
      streetViewUrl: getStreetViewUrl(loc.lat, loc.lng, loc.heading),
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading,
    }));

    const body: GameSession = { sessionToken, rounds: publicRounds };
    return NextResponse.json(body);
  } catch (err) {
    console.error("/api/game error:", err);
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
  }
}
