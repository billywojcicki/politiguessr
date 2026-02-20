import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/sessionToken";
import { createServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const today = new Date().toISOString().slice(0, 10);

  let body: {
    sessionToken: string;
    guesses: { roundNumber: number; guessedMargin: number }[];
    displayName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { sessionToken, guesses, displayName } = body;

  // Verify the HMAC session token
  const secretRounds = verifyToken(sessionToken);
  if (!secretRounds || secretRounds.length === 0) {
    return NextResponse.json({ error: "Invalid session token" }, { status: 400 });
  }

  // Recalculate all scores server-side
  const roundResults = secretRounds.map((secret) => {
    const guess = guesses.find((g) => g.roundNumber === secret.roundNumber);
    const guessedMargin = guess?.guessedMargin ?? 0;
    const diff = Math.abs(secret.margin - guessedMargin);
    const score = Math.max(0, Math.round(100 - diff));
    return {
      roundNumber: secret.roundNumber,
      fips: secret.fips,
      county: secret.county,
      state: secret.state,
      town: secret.town,
      actualMargin: secret.margin,
      guessedMargin,
      score,
    };
  });

  const totalScore = roundResults.reduce((s, r) => s + r.score, 0);

  // Resolve identity
  let userId: string | null = null;
  let resolvedDisplayName: string;
  let isRegistered = false;

  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      userId = user.id;
      isRegistered = true;
      // Use their username, fall back to email prefix
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      resolvedDisplayName = profile?.username ?? user.email?.split("@")[0] ?? "Player";
    } else {
      resolvedDisplayName = (displayName ?? "").trim().slice(0, 20) || "Guest";
    }
  } else {
    resolvedDisplayName = (displayName ?? "").trim().slice(0, 20) || "Guest";
  }

  // Insert score (UNIQUE constraint prevents double-submission for registered users)
  const { error: insertError } = await supabase.from("daily_challenge_scores").insert({
    challenge_date: today,
    user_id: userId,
    display_name: resolvedDisplayName,
    is_registered: isRegistered,
    total_score: totalScore,
    rounds: roundResults,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Already submitted today" }, { status: 409 });
    }
    console.error("daily submit error:", insertError.message);
    return NextResponse.json({ error: "Failed to save score" }, { status: 500 });
  }

  // Calculate rank
  const { count: betterCount } = await supabase
    .from("daily_challenge_scores")
    .select("*", { count: "exact", head: true })
    .eq("challenge_date", today)
    .gt("total_score", totalScore);

  const rank = (betterCount ?? 0) + 1;

  // Fetch top 20 leaderboard (filter in JS — PostgREST date .eq() has a casting quirk)
  const { data: leaderboardRows } = await supabase
    .from("daily_challenge_scores")
    .select("challenge_date, display_name, is_registered, total_score")
    .order("total_score", { ascending: false })
    .order("submitted_at", { ascending: true });

  const leaderboard = (leaderboardRows ?? [])
    .filter((row) => String(row.challenge_date) === today)
    .slice(0, 20)
    .map((row, i) => ({
      display_name: row.display_name,
      is_registered: row.is_registered,
      total_score: row.total_score,
      rank: i + 1,
    }));

  return NextResponse.json({ totalScore, rank, leaderboard, displayName: resolvedDisplayName });
}
