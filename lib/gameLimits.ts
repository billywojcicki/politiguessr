/**
 * Client-side limit checking — used as a fast UX gate before hitting the API.
 * No DB calls. Anonymous users: localStorage. Signed-in users: sessionStorage cache.
 * The server enforces the real limits in /api/game.
 */
import { supabase } from "./supabase";

export const ANON_DAILY_LIMIT = 3;
export const FREE_DAILY_LIMIT = 6;

export type Tier = "anon" | "free" | "pro";

export interface LimitCheck {
  canPlay: boolean;
  tier: Tier;
  played: number;
  limit: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Anonymous (localStorage) ─────────────────────────────────────────────

export function getAnonGamesPlayedToday(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(`pg_games_${todayKey()}`);
  return stored ? parseInt(stored, 10) : 0;
}

export function incrementAnonGamesPlayed(): void {
  if (typeof window === "undefined") return;
  const key = `pg_games_${todayKey()}`;
  localStorage.setItem(key, String(getAnonGamesPlayedToday() + 1));
}

// ── Signed-in users (sessionStorage — no DB calls) ───────────────────────

export function getSignedInGamesCount(): number {
  if (typeof window === "undefined") return 0;
  const stored = sessionStorage.getItem(`pg_session_${todayKey()}`);
  return stored ? parseInt(stored, 10) : 0;
}

export function incrementSignedInGamesCount(): void {
  if (typeof window === "undefined") return;
  const key = `pg_session_${todayKey()}`;
  sessionStorage.setItem(key, String(getSignedInGamesCount() + 1));
}

export function getCachedTier(): "free" | "pro" | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem("pg_tier");
  return stored === "free" || stored === "pro" ? stored : null;
}

export function cacheUserTier(tier: "free" | "pro"): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("pg_tier", tier);
}

// ── Main check ───────────────────────────────────────────────────────────

export async function checkGameLimit(): Promise<LimitCheck> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    const played = getAnonGamesPlayedToday();
    return { canPlay: played < ANON_DAILY_LIMIT, tier: "anon", played, limit: ANON_DAILY_LIMIT };
  }

  // Use cached tier — populated from server response after first game
  const cachedTier = getCachedTier();
  if (cachedTier === "pro") {
    return { canPlay: true, tier: "pro", played: 0, limit: Infinity };
  }

  const played = getSignedInGamesCount();

  // If tier isn't cached yet, let the server decide rather than risk blocking a pro user
  if (!cachedTier) {
    return { canPlay: true, tier: "free", played, limit: FREE_DAILY_LIMIT };
  }

  return { canPlay: played < FREE_DAILY_LIMIT, tier: "free", played, limit: FREE_DAILY_LIMIT };
}
