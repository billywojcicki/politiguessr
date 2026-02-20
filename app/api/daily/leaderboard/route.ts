import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  // Note: .eq("challenge_date", today) returns 0 rows due to a PostgREST date type
  // casting quirk. Fetch all rows and filter in JS instead.
  const { data, error } = await supabase
    .from("daily_challenge_scores")
    .select("challenge_date, display_name, is_registered, total_score")
    .order("total_score", { ascending: false })
    .order("submitted_at", { ascending: true });

  if (error) {
    console.error("[leaderboard] supabase error:", error.message, error.code);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }

  const leaderboard = (data ?? [])
    .filter((row) => String(row.challenge_date) === today)
    .slice(0, 20)
    .map((row, i) => ({
      display_name: row.display_name,
      is_registered: row.is_registered,
      total_score: row.total_score,
      rank: i + 1,
    }));

  return NextResponse.json({ leaderboard, challengeDate: today }, {
    headers: { "Cache-Control": "no-store" },
  });
}
