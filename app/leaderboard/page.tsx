"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DailyLeaderboard from "@/components/DailyLeaderboard";
import { supabase } from "@/lib/supabase";
import DailyResetTimer from "@/components/DailyResetTimer";
import type { LeaderboardEntry } from "@/lib/types";

const DAILY_KEY = () => `pg_daily_${new Date().toISOString().slice(0, 10)}`;

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myName, setMyName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Check if signed-in user has played today
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch("/api/daily", {
          headers: { "Authorization": `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setDate(data.challengeDate ?? "");
          if (data.alreadyPlayed) {
            setMyScore(data.entry.total_score);
            setMyRank(data.entry.rank);
            setLeaderboard(data.leaderboard ?? []);
            setLoading(false);
            return;
          }
        }
      } else {
        // Anonymous: check localStorage
        const stored = localStorage.getItem(DAILY_KEY());
        if (stored) {
          const saved = JSON.parse(stored) as { totalScore: number };
          setMyScore(saved.totalScore);
        }
      }

      // Fall back to standalone leaderboard fetch
      const res = await fetch("/api/daily/leaderboard", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard ?? []);
        setDate(data.challengeDate ?? "");
      }
      setLoading(false);
    }

    load();
  }, []);

  // Find the user's display name in the leaderboard for highlighting
  // (only reliable for registered users via the alreadyPlayed entry)
  const highlightName = myName;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="border-b border-white/20 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase"
        >
          ← Home
        </Link>
        <span className="font-mono text-xs text-amber-400/70 tracking-widest uppercase">Daily Challenge</span>
        <Link
          href="/daily"
          className="font-mono text-xs text-amber-400/60 hover:text-amber-400 border border-amber-400/20 hover:border-amber-400/60 px-2 py-1 tracking-widest uppercase"
        >
          Play →
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">

          {/* My score (if played) */}
          {myScore !== null && (
            <>
              <div className="space-y-1">
                <p className="font-mono text-xs text-white/30 tracking-widest uppercase">Your score today</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-bold tabular-nums">{myScore}</span>
                  <span className="font-mono text-white/20">/ 500</span>
                  {myRank !== null && (
                    <span className="font-mono text-xs text-amber-400/60 tracking-wider">Rank #{myRank}</span>
                  )}
                </div>
                {date && <p className="font-mono text-xs text-white/20 tracking-wider">{date}</p>}
              </div>
              <div className="border-t border-white/10" />
            </>
          )}

          {/* Leaderboard */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-white/30 tracking-widest uppercase">Today&apos;s Leaderboard</p>
              {myScore === null && date && (
                <span className="font-mono text-xs text-white/20 tracking-wider">{date}</span>
              )}
            </div>
            {loading ? (
              <p className="font-mono text-xs text-white/20 tracking-widest animate-pulse py-4">Loading…</p>
            ) : (
              <DailyLeaderboard leaderboard={leaderboard} highlightName={highlightName} />
            )}
          </div>

          <DailyResetTimer />

        </div>
      </div>
    </div>
  );
}
