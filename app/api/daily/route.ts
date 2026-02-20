import { NextRequest, NextResponse } from "next/server";
import { getDailyLocations, getElectionData, getStreetViewUrl } from "@/lib/gameData";
import { createToken } from "@/lib/sessionToken";
import { createServerClient } from "@/lib/supabaseServer";
import type { RoundPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getLeaderboard(supabase: ReturnType<typeof createServerClient>, date: string) {
  // Note: .eq("challenge_date", date) has a PostgREST date type casting quirk — filter in JS.
  const { data } = await supabase
    .from("daily_challenge_scores")
    .select("challenge_date, display_name, is_registered, total_score")
    .order("total_score", { ascending: false })
    .order("submitted_at", { ascending: true });
  return (data ?? [])
    .filter((row) => String(row.challenge_date) === date)
    .slice(0, 20)
    .map((row, i) => ({
      display_name: row.display_name,
      is_registered: row.is_registered,
      total_score: row.total_score,
      rank: i + 1,
    }));
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  // Check if signed-in user already played today
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: existing } = await supabase
        .from("daily_challenge_scores")
        .select("total_score")
        .eq("user_id", user.id)
        .eq("challenge_date", today)
        .single();

      if (existing) {
        const { count: betterCount } = await supabase
          .from("daily_challenge_scores")
          .select("*", { count: "exact", head: true })
          .eq("challenge_date", today)
          .gt("total_score", existing.total_score);

        const leaderboard = await getLeaderboard(supabase, today);
        return NextResponse.json({
          alreadyPlayed: true,
          entry: { total_score: existing.total_score, rank: (betterCount ?? 0) + 1 },
          leaderboard,
          challengeDate: today,
        });
      }
    }
  }

  // Build today's session
  const locs = getDailyLocations(today);
  const election = getElectionData();

  const secretRounds = locs.map((loc, i) => ({
    roundNumber: i + 1,
    fips: loc.fips,
    county: election[loc.fips]?.county ?? "Unknown County",
    state: election[loc.fips]?.state ?? "Unknown",
    town: loc.town ?? null,
    margin: election[loc.fips]?.margin ?? 0,
  }));

  const sessionToken = createToken(secretRounds);

  const publicRounds: RoundPublic[] = locs.map((loc, i) => ({
    roundNumber: i + 1,
    streetViewUrl: getStreetViewUrl(loc.lat, loc.lng, loc.heading),
    lat: loc.lat,
    lng: loc.lng,
    heading: loc.heading,
  }));

  return NextResponse.json({ sessionToken, rounds: publicRounds, challengeDate: today });
}
