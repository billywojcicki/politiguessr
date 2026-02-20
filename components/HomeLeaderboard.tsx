"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DailyLeaderboard from "./DailyLeaderboard";
import type { LeaderboardEntry } from "@/lib/types";

export default function HomeLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");

  useEffect(() => {
    fetch("/api/daily/leaderboard", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text();
          console.error("[HomeLeaderboard] API error", r.status, text);
          return;
        }
        const data = await r.json();
        setLeaderboard((data.leaderboard ?? []).slice(0, 5));
        setDate(data.challengeDate ?? "");
      })
      .catch((err) => console.error("[HomeLeaderboard] fetch failed", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-white/30 tracking-widest uppercase">
          Today&apos;s Leaderboard
        </p>
        {date && (
          <span className="font-mono text-xs text-white/20 tracking-wider">{date}</span>
        )}
      </div>

      {loading ? (
        <p className="font-mono text-xs text-white/20 tracking-widest animate-pulse py-2">Loading…</p>
      ) : (
        <DailyLeaderboard leaderboard={leaderboard} />
      )}

      {!loading && (
        <Link
          href="/leaderboard"
          className="block w-full text-center font-mono text-xs text-white/25 hover:text-white/50 tracking-widest uppercase transition-colors duration-150 py-1"
        >
          View full leaderboard →
        </Link>
      )}
    </div>
  );
}
