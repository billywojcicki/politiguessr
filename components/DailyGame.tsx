"use client";

import { useState, useCallback, useEffect } from "react";
import MarginSlider, { formatMargin, marginColor } from "./MarginSlider";
import CountdownTimer from "./CountdownTimer";
import StreetViewPanorama from "./StreetViewPanorama";
import CountyMap from "./CountyMap";
import AuthModal from "./AuthModal";
import DailyLeaderboard from "./DailyLeaderboard";
import DailyResetTimer from "./DailyResetTimer";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { GameSession, GuessResult, LeaderboardEntry, DailySubmitResult, RoundPublic } from "@/lib/types";

const ROUNDS = 5;
const ROUND_SECONDS = 30;

const DAILY_KEY = () => `pg_daily_${new Date().toISOString().slice(0, 10)}`;

type Phase = "loading" | "playing" | "reveal" | "done" | "already-played";

interface RoundResult extends GuessResult {
  timedOut: boolean;
}

function stateAbbr(stateName: string): string {
  const map: Record<string, string> = {
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
    Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
    Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
    Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
    Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
    Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH",
    "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
    "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN",
    Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
    "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
  };
  return map[stateName] ?? stateName;
}

export default function DailyGame() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<GameSession | null>(null);
  const [challengeDate, setChallengeDate] = useState("");
  const [currentRound, setCurrentRound] = useState(0);
  const [guessedMargin, setGuessedMargin] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);

  // Done/submit state
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "submitted" | "skipped" | "error">("idle");
  const [submitResult, setSubmitResult] = useState<DailySubmitResult | null>(null);
  const [guestName, setGuestName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedDisplayName, setSubmittedDisplayName] = useState<string | null>(null);

  // Already-played state
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [prevRank, setPrevRank] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const startGame = useCallback(async () => {
    // Check auth FIRST — signed-in users always consult the API (DB is source of truth)
    const { data: { session: authSession } } = await supabase.auth.getSession();

    if (authSession?.access_token) {
      const res = await fetch("/api/daily", {
        headers: { "Authorization": `Bearer ${authSession.access_token}` },
      });
      if (!res.ok) { setPhase("loading"); return; }
      const data = await res.json();
      setChallengeDate(data.challengeDate ?? "");
      if (data.alreadyPlayed) {
        setPrevScore(data.entry.total_score);
        setPrevRank(data.entry.rank);
        setLeaderboard(data.leaderboard ?? []);
        setPhase("already-played");
        return;
      }
      setSession(data);
      setTimerKey((k) => k + 1);
      setTimerPaused(false);
      setPhase("playing");
      return;
    }

    // Anonymous user: check localStorage
    const stored = localStorage.getItem(DAILY_KEY());
    if (stored) {
      const saved = JSON.parse(stored) as { totalScore: number };
      setPrevScore(saved.totalScore);
      try {
        const lbRes = await fetch("/api/daily/leaderboard");
        if (lbRes.ok) {
          const lbData = await lbRes.json();
          setLeaderboard(lbData.leaderboard ?? []);
          setChallengeDate(lbData.challengeDate ?? "");
        }
      } catch (e) {
        console.error("[DailyGame] leaderboard fetch error", e);
      }
      setPhase("already-played");
      return;
    }

    // Anonymous user, hasn't played yet
    const res = await fetch("/api/daily");
    if (!res.ok) { setPhase("loading"); return; }
    const data = await res.json();
    setChallengeDate(data.challengeDate ?? "");
    setSession(data);
    setTimerKey((k) => k + 1);
    setTimerPaused(false);
    setPhase("playing");
  }, []);

  useEffect(() => { startGame(); }, [startGame]);

  const submitGuess = useCallback(
    async (margin: number, timedOut = false) => {
      if (!session || phase !== "playing") return;
      setTimerPaused(true);
      setPhase("reveal");
      const round = session.rounds[currentRound];
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: session.sessionToken, roundNumber: round.roundNumber, guessedMargin: margin }),
      });
      if (!res.ok) return;
      const result = (await res.json()) as GuessResult;
      const roundResult: RoundResult = { ...result, timedOut };
      setCurrentResult(roundResult);
      setResults((prev) => [...prev, roundResult]);
      setAutoAdvanceCountdown(10);
    },
    [session, phase, currentRound]
  );

  useEffect(() => {
    if (autoAdvanceCountdown === null) return;
    if (autoAdvanceCountdown <= 0) { setAutoAdvanceCountdown(null); advance(); return; }
    const id = setTimeout(() => setAutoAdvanceCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceCountdown]);

  const advance = useCallback(() => {
    setAutoAdvanceCountdown(null);
    const next = currentRound + 1;
    if (next >= ROUNDS) {
      setPhase("done");
    } else {
      setCurrentRound(next);
      setGuessedMargin(0);
      setTimerKey((k) => k + 1);
      setTimerPaused(false);
      setPhase("playing");
    }
  }, [currentRound]);

  // Auto-submit for signed-in users when game ends
  useEffect(() => {
    if (phase !== "done" || results.length < ROUNDS || submitState !== "idle") return;
    if (user === undefined) return; // wait for auth to resolve
    if (!user) return; // anon — wait for manual submit

    const doSubmit = async () => {
      setSubmitState("submitting");
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authSession?.access_token) headers["Authorization"] = `Bearer ${authSession.access_token}`;

      const guesses = results.map((r) => ({ roundNumber: r.roundNumber, guessedMargin: r.guessedMargin }));
      const res = await fetch("/api/daily/submit", {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionToken: session!.sessionToken, guesses }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to save score");
        setSubmitState("error");
        return;
      }
      setSubmitResult(data as DailySubmitResult);
      setSubmittedDisplayName(data.displayName ?? null);
      setSubmitState("submitted");
      localStorage.setItem(DAILY_KEY(), JSON.stringify({ totalScore: data.totalScore }));
    };

    doSubmit();
  }, [phase, results, user, submitState, session]);

  const submitAsGuest = async () => {
    const name = guestName.trim().slice(0, 20);
    setSubmitState("submitting");
    setSubmitError(null);

    const guesses = results.map((r) => ({ roundNumber: r.roundNumber, guessedMargin: r.guessedMargin }));
    const res = await fetch("/api/daily/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: session!.sessionToken, guesses, displayName: name }),
    });

    const data = await res.json();
    if (!res.ok) {
      setSubmitError(data.error ?? "Failed to save score");
      setSubmitState("error");
      return;
    }
    setSubmitResult(data as DailySubmitResult);
    setSubmittedDisplayName(name || null);
    setSubmitState("submitted");
    localStorage.setItem(DAILY_KEY(), JSON.stringify({ totalScore: data.totalScore }));
  };

  const skipSubmit = () => {
    setSubmitState("skipped");
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    localStorage.setItem(DAILY_KEY(), JSON.stringify({ totalScore }));
    // Fetch leaderboard to show anyway
    fetch("/api/daily/leaderboard").then((r) => r.json()).then((d) => {
      setLeaderboard(d.leaderboard ?? []);
    });
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <span className="font-mono text-xs tracking-widest text-white/30 uppercase animate-pulse">Loading…</span>
      </div>
    );
  }

  // ── Already Played ────────────────────────────────────────────────────────
  if (phase === "already-played") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col overflow-y-auto">
        <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <a href="/" className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150">
            ← Home
          </a>
          <span className="font-mono text-xs text-amber-400/70 tracking-widest uppercase">Daily Challenge</span>
          <AuthModal compact />
        </div>
        <div className="flex-1 flex items-start justify-center px-6 py-10">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1">
              <p className="font-mono text-xs text-white/30 tracking-widest uppercase">Already played today</p>
              {prevScore !== null && (
                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-bold tabular-nums">{prevScore}</span>
                  <span className="font-mono text-white/20">/ 500</span>
                  {prevRank !== null && (
                    <span className="font-mono text-xs text-amber-400/60 tracking-wider">Rank #{prevRank}</span>
                  )}
                </div>
              )}
              {challengeDate && (
                <p className="font-mono text-xs text-white/20 tracking-wider">{challengeDate}</p>
              )}
            </div>
            <div className="border-t border-white/10" />
            <div className="space-y-3">
              <p className="font-mono text-xs text-white/30 tracking-widest uppercase">Today&apos;s Leaderboard</p>
              <DailyLeaderboard leaderboard={leaderboard} />
            </div>
            <DailyResetTimer />
            <a
              href="/"
              className="block w-full border border-white/30 py-3 font-mono text-sm tracking-widest uppercase text-center text-white/50 hover:border-white hover:text-white transition-colors duration-150"
            >
              ← Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === "done") {
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const maxScore = ROUNDS * 100;
    const pct = totalScore / maxScore;
    const grade = pct >= 0.9 ? "S" : pct >= 0.75 ? "A" : pct >= 0.6 ? "B" : pct >= 0.45 ? "C" : "D";
    const displayLeaderboard = submitResult?.leaderboard ?? leaderboard;

    return (
      <div className="fixed inset-0 bg-black flex flex-col overflow-y-auto">
        <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-xs text-white/30 tracking-widest uppercase">PolitiGuessr</span>
          <span className="font-mono text-xs text-amber-400/70 tracking-widest uppercase">Daily Challenge</span>
          <AuthModal compact />
        </div>
        <div className="flex-1 flex items-start justify-center px-6 py-10">
          <div className="w-full max-w-sm space-y-6">
            {/* Score */}
            <div className="space-y-1">
              <p className="font-mono text-xs text-white/30 tracking-widest uppercase">Final score</p>
              <div className="flex items-baseline gap-3">
                <span className={`text-7xl font-bold tabular-nums leading-none ${pct >= 0.9 ? "text-yellow-400" : pct >= 0.6 ? "text-white" : "text-white/50"}`}>
                  {totalScore}
                </span>
                <span className="font-mono text-white/20 text-lg">/ {maxScore}</span>
              </div>
              <p className="font-mono text-xs text-white/30 tracking-widest">GRADE {grade}</p>
              {submitResult && (
                <p className="font-mono text-xs text-amber-400/60 tracking-wider">Rank #{submitResult.rank}</p>
              )}
            </div>

            <div className="border-t border-white/10" />

            {/* Round breakdown */}
            <div className="divide-y divide-white/10 border border-white/10">
              {results.map((r, i) => {
                const loc = session!.rounds[i];
                return (
                  <div key={r.roundNumber} className="flex items-center px-3 py-2.5 gap-3">
                    <span className="font-mono text-xs text-white/20 w-4">{r.roundNumber}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.county}, {stateAbbr(r.state)}{r.town ? ` · ${r.town}` : ""}</div>
                      <div className="font-mono text-xs text-white/30 flex gap-3 mt-0.5">
                        <span>Actual <span className={marginColor(r.actualMargin)}>{formatMargin(r.actualMargin)}</span></span>
                        <span>Guess <span className={marginColor(r.guessedMargin)}>{formatMargin(r.guessedMargin)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-mono text-sm font-bold tabular-nums text-white">
                        {r.score} <span className="text-xs font-normal text-white/40">pts</span>
                      </span>
                      <ReviewModal loc={loc} result={r} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10" />

            {/* Leaderboard submission */}
            <div className="space-y-3">
              <p className="font-mono text-xs text-white/30 tracking-widest uppercase">Today&apos;s Leaderboard</p>

              {/* Anon submit form */}
              {!user && (submitState === "idle" || submitState === "error") && (
                <div className="space-y-2">
                  <p className="font-mono text-xs text-white/40 tracking-wider">Post your score — enter a name or skip.</p>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name (optional)"
                    maxLength={20}
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                  />
                  {submitError && <p className="font-mono text-xs text-red-400">{submitError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={skipSubmit}
                      className="flex-1 border border-white/20 py-2.5 font-mono text-xs tracking-widest uppercase text-white/30 hover:border-white/40 hover:text-white/60 transition-colors duration-150"
                    >
                      Skip
                    </button>
                    <button
                      onClick={submitAsGuest}
                      className="flex-1 border border-amber-400/60 py-2.5 font-mono text-xs tracking-widest uppercase text-amber-400/60 hover:border-amber-400 hover:text-amber-400 transition-colors duration-150"
                    >
                      Post Score →
                    </button>
                  </div>
                </div>
              )}

              {(submitState === "idle" || submitState === "submitting") && (
                <p className="font-mono text-xs text-white/30 tracking-widest animate-pulse">Saving to leaderboard…</p>
              )}

              {submitState === "error" && (
                <p className="font-mono text-xs text-red-400">{submitError ?? "Failed to save score"}</p>
              )}

              {(submitState === "submitted" || submitState === "skipped") && (
                <DailyLeaderboard leaderboard={displayLeaderboard} highlightName={submittedDisplayName} />
              )}
            </div>

            <a
              href="/"
              className="block w-full border border-white/30 py-3 font-mono text-sm tracking-widest uppercase text-center text-white/50 hover:border-white hover:text-white transition-colors duration-150"
            >
              ← Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing / Reveal ──────────────────────────────────────────────────────
  const round = session!.rounds[currentRound];
  const totalScore = results.reduce((s, r) => s + r.score, 0);

  return (
    <div className="fixed inset-0">
      <StreetViewPanorama lat={round.lat} lng={round.lng} heading={round.heading} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="font-mono text-xs text-white/20 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
          >
            Quit
          </a>
          <span className="font-mono text-xs tracking-widest text-white/50 tabular-nums">
            <span className="text-white">{currentRound + 1}</span>/{ROUNDS}
          </span>
        </div>
        <CountdownTimer
          key={timerKey}
          seconds={ROUND_SECONDS}
          onExpire={() => submitGuess(guessedMargin, true)}
          paused={timerPaused}
        />
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tracking-widest text-white/50 tabular-nums">
            <span className="text-white">{String(totalScore).padStart(3, "0")}</span>
          </span>
          <span className="font-mono text-xs px-2 py-1 border border-amber-400/40 text-amber-400/60 tracking-widest uppercase">
            Daily
          </span>
        </div>
      </div>

      {/* Guess panel */}
      {phase === "playing" && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4">
          <div className="w-full max-w-md mx-auto bg-black border border-white/20 p-3 space-y-2.5">
            <MarginSlider value={guessedMargin} onChange={setGuessedMargin} />
            <div className="flex items-center gap-3">
              <span className={`font-mono text-xl font-bold tabular-nums tracking-tight flex-shrink-0 w-24 ${marginColor(guessedMargin)}`}>
                {formatMargin(guessedMargin)}
              </span>
              <button
                onClick={() => submitGuess(guessedMargin)}
                className="flex-1 border border-white py-2.5 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150"
              >
                Lock In →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reveal panel */}
      {phase === "reveal" && currentResult && (
        <DailyRevealPanel
          result={currentResult}
          onAdvance={advance}
          isLastRound={currentRound + 1 >= ROUNDS}
          autoAdvanceCountdown={autoAdvanceCountdown}
        />
      )}
    </div>
  );
}

// ── Reveal Panel ──────────────────────────────────────────────────────────

interface RevealPanelProps {
  result: RoundResult;
  onAdvance: () => void;
  isLastRound: boolean;
  autoAdvanceCountdown: number | null;
}

function DailyRevealPanel({ result, onAdvance, isLastRound, autoAdvanceCountdown }: RevealPanelProps) {
  const isRed = result.actualMargin > 0.5;
  const isBlue = result.actualMargin < -0.5;
  const diff = Math.abs(result.actualMargin - result.guessedMargin);
  const gotPartyRight =
    (result.actualMargin > 0.5 && result.guessedMargin > 0.5) ||
    (result.actualMargin < -0.5 && result.guessedMargin < -0.5) ||
    (Math.abs(result.actualMargin) <= 0.5 && Math.abs(result.guessedMargin) <= 0.5);
  const accuracy = !gotPartyRight ? "Wrong party" : diff < 5 ? "Nailed it" : diff < 15 ? "Correct" : "Right party";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-black border border-white/20">
        <div className="border-b border-white/10 bg-[#0a0a0a]" style={{ height: 180 }}>
          <CountyMap fips={result.fips} className="w-full h-full" />
        </div>
        <div className="px-5 pt-4 pb-2 border-b border-white/10 space-y-0.5">
          {result.timedOut && (
            <p className="font-mono text-xs text-yellow-400 tracking-widest uppercase mb-2">⏱ Time&apos;s up</p>
          )}
          <h2 className="text-2xl font-bold leading-tight tracking-tight">{result.county}</h2>
          {result.town && <p className="font-mono text-xs text-white/60 tracking-wider">{result.town}</p>}
          <p className="font-mono text-xs text-white/40 tracking-wider uppercase">{result.state}</p>
          <p className={`text-4xl font-bold tabular-nums mt-2 ${isRed ? "text-red-500" : isBlue ? "text-blue-500" : "text-white/50"}`}>
            {formatMargin(result.actualMargin)}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
          {[
            { label: "Your Guess", value: formatMargin(result.guessedMargin), color: marginColor(result.guessedMargin) },
            { label: accuracy, value: `+${result.score}`, color: result.score >= 80 ? "text-white" : result.score >= 50 ? "text-white/60" : "text-white/30" },
            { label: "Off by", value: `${diff.toFixed(1)}`, color: "text-white/50" },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-3 py-3 text-center space-y-1">
              <p className="font-mono text-xs text-white/25 tracking-wider uppercase leading-tight">{label}</p>
              <p className={`font-mono text-sm font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="p-4">
          <button
            onClick={onAdvance}
            className="w-full border border-white py-3 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150"
          >
            {isLastRound ? "See Results" : `Next Round${autoAdvanceCountdown !== null ? ` (${autoAdvanceCountdown})` : ""}`} →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Review Modal ──────────────────────────────────────────────────────────

function ReviewModal({ loc, result }: { loc: RoundPublic; result: RoundResult }) {
  const [open, setOpen] = useState(false);
  const isRed = result.actualMargin > 0.5;
  const isBlue = result.actualMargin < -0.5;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
      >
        Review
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <span className="font-bold text-sm">{result.county}, {stateAbbr(result.state)}{result.town ? ` · ${result.town}` : ""}</span>
              <span className={`font-mono text-sm ml-3 ${isRed ? "text-red-500" : isBlue ? "text-blue-500" : "text-white/50"}`}>
                {formatMargin(result.actualMargin)}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="font-mono text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
            >
              ← Back
            </button>
          </div>
          <div className="border-b border-yellow-400/20 bg-yellow-400/5 px-4 py-1.5 text-center flex-shrink-0">
            <span className="font-mono text-xs text-yellow-400/70 tracking-widest uppercase">
              Review mode — not a live game
            </span>
          </div>
          <div className="flex-1">
            <StreetViewPanorama lat={loc.lat} lng={loc.lng} heading={loc.heading} />
          </div>
        </div>
      )}
    </>
  );
}
