import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

import { pickRandomLocations, getElectionData, getStreetViewUrl } from "@/lib/gameData";
import { createToken } from "@/lib/sessionToken";
import { createServerClient } from "@/lib/supabaseServer";
import type { RoundPublic, GameSession } from "@/lib/types";

const ROUNDS_PER_GAME = 5;
const ANON_DAILY_LIMIT = 3;
const FREE_DAILY_LIMIT = 6;

type Tier = "anon" | "free" | "pro";

interface RateLimitResult {
  allowed: boolean;
  tier: Tier;
}

async function enforceRateLimit(req: NextRequest): Promise<RateLimitResult> {
  const supabase = createServerClient();

  // ── Signed-in user ──────────────────────────────────────────────────────
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();
      const tier = (profile?.tier as "free" | "pro") ?? "free";

      if (tier === "pro") return { allowed: true, tier: "pro" };

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("played_at", start.toISOString());

      return { allowed: (count ?? 0) < FREE_DAILY_LIMIT, tier: "free" };
    }
  }

  // ── Anonymous — IP-based with atomic DB increment ───────────────────────
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  // Hash the IP with SESSION_SECRET so raw IPs are never stored
  const ipHash = createHash("sha256")
    .update(ip + (process.env.SESSION_SECRET ?? ""))
    .digest("hex")
    .slice(0, 32);

  const today = new Date().toISOString().slice(0, 10);

  const { data: allowed, error } = await supabase.rpc("check_and_increment_anon", {
    p_ip_hash: ipHash,
    p_date: today,
    p_limit: ANON_DAILY_LIMIT,
  });

  if (error) {
    // If the function isn't set up yet, fail open rather than blocking everyone
    console.error("anon rate limit RPC error:", error.message);
    return { allowed: true, tier: "anon" };
  }

  return { allowed: allowed === true, tier: "anon" };
}

export async function GET(req: NextRequest) {
  try {
    const { allowed, tier } = await enforceRateLimit(req);

    if (!allowed) {
      return NextResponse.json({ error: "limit_reached", tier }, { status: 429 });
    }

    const locs = pickRandomLocations(ROUNDS_PER_GAME);
    const election = getElectionData();

    const secretRounds = locs.map((loc, i) => {
      const result = election[loc.fips];
      return {
        roundNumber: i + 1,
        fips: loc.fips,
        county: result?.county ?? "Unknown County",
        state: result?.state ?? "Unknown",
        town: loc.town ?? null,
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

    const body: GameSession = { sessionToken, rounds: publicRounds, tier };
    return NextResponse.json(body);
  } catch (err) {
    console.error("/api/game error:", err);
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 });
  }
}
