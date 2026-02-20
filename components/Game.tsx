"use client";

import { useState, useCallback, useEffect } from "react";
import MarginSlider, { formatMargin, marginColor } from "./MarginSlider";
import CountdownTimer from "./CountdownTimer";
import StreetViewPanorama from "./StreetViewPanorama";
import CountyMap from "./CountyMap";
import AuthModal from "./AuthModal";
import { supabase } from "@/lib/supabase";
import {
  checkGameLimit,
  incrementAnonGamesPlayed,
  incrementSignedInGamesCount,
  cacheUserTier,
} from "@/lib/gameLimits";
import type { Tier } from "@/lib/gameLimits";
import type { User } from "@supabase/supabase-js";
import type { GameSession, GuessResult } from "@/lib/types";

const ROUNDS = 5;
const ROUND_SECONDS = 15;

type Phase = "loading" | "playing" | "reveal" | "done" | "limited";

interface RoundResult extends GuessResult {
  timedOut: boolean;
}

export default function Game() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<GameSession | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [guessedMargin, setGuessedMargin] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [scoreSaveError, setScoreSaveError] = useState(false);
  const [limitTier, setLimitTier] = useState<Tier>("anon");

  const startGame = useCallback(async () => {
    setPhase("loading");
    setResults([]);
    setCurrentRound(0);
    setGuessedMargin(0);
    setScoreSaved(false);
    setScoreSaveError(false);

    // Client-side UX gate — fast, no DB calls
    const { canPlay, tier: clientTier } = await checkGameLimit();
    if (!canPlay) {
      setLimitTier(clientTier);
      setPhase("limited");
      return;
    }

    // Send auth token so server can enforce signed-in limits
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (authSession?.access_token) {
      headers["Authorization"] = `Bearer ${authSession.access_token}`;
    }

    const res = await fetch("/api/game", { headers });

    if (res.status === 429) {
      const err = await res.json() as { tier: Tier };
      setLimitTier(err.tier);
      setPhase("limited");
      return;
    }

    if (!res.ok) return;
    const data = (await res.json()) as GameSession;

    // Update client-side counters and tier cache
    if (!authSession?.user) {
      incrementAnonGamesPlayed();
    } else {
      incrementSignedInGamesCount();
      if (data.tier && data.tier !== "anon") cacheUserTier(data.tier);
    }

    setSession(data);
    setTimerKey((k) => k + 1);
    setTimerPaused(false);
    setPhase("playing");
  }, []);

  useEffect(() => { startGame(); }, [startGame]);

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // If user signs in while on the limited screen, re-check and auto-start if now allowed
  useEffect(() => {
    if (phase !== "limited" || !user) return;
    checkGameLimit().then(({ canPlay }) => { if (canPlay) startGame(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Save score when game ends (fires immediately if logged in, or when user logs in on done screen)
  useEffect(() => {
    if (phase !== "done" || results.length === 0 || scoreSaved || !user) return;
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    supabase.from("games").insert({
      user_id: user.id,
      total_score: totalScore,
      rounds: results,
    }).then(({ error }) => {
      if (!error) setScoreSaved(true);
      else setScoreSaveError(true);
    });
  }, [phase, user, scoreSaved, results]);

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
      setAutoAdvanceCountdown(6);
    },
    [session, phase, currentRound]
  );

  useEffect(() => {
    if (autoAdvanceCountdown === null) return;
    if (devMode) return;
    if (autoAdvanceCountdown <= 0) { setAutoAdvanceCountdown(null); advance(); return; }
    const id = setTimeout(() => setAutoAdvanceCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceCountdown, devMode]);

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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <span className="font-mono text-xs tracking-widest text-white/30 uppercase animate-pulse">Loading…</span>
      </div>
    );
  }

  // ── Limited ───────────────────────────────────────────────────────────────
  if (phase === "limited") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col overflow-y-auto">
        <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-xs text-white/30 tracking-widest uppercase">PolitiGuessr</span>
          <AuthModal />
        </div>
        <div className="flex-1 flex items-start justify-center px-6 py-10">
          <div className="w-full max-w-sm space-y-6">
            <div className="space-y-1">
              <p className="font-mono text-xs text-white/30 tracking-widest uppercase">Daily Limit</p>
              <h2 className="text-3xl font-bold leading-tight tracking-tight">
                {limitTier === "anon" ? "3 games a day" : "6 games a day"}
              </h2>
              <p className="font-mono text-xs text-white/40 tracking-wider">
                {limitTier === "anon" ? "Free accounts get 6." : "Pro accounts get unlimited."}
              </p>
            </div>

            <div className="border-t border-white/10" />

            {limitTier === "anon" ? (
              <div className="space-y-3">
                <p className="font-mono text-xs text-white/40 tracking-wider leading-relaxed">
                  Sign in for 6 games per day.
                </p>
                <AuthModal />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-mono text-xs text-white/40 tracking-wider leading-relaxed">
                  Upgrade to Pro for unlimited games per day.
                </p>
                <div className="border border-white/10 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-widest uppercase text-white/50">Pro Plan</span>
                    <span className="font-mono text-xs text-white/20 border border-white/10 px-1.5 py-0.5 tracking-widest">Coming Soon</span>
                  </div>
                  <p className="text-sm text-white/40">Unlimited games · more features planned</p>
                </div>
              </div>
            )}

            <p className="font-mono text-xs text-white/20 tracking-wider text-center">
              Resets at midnight
            </p>

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

  // ── Done ─────────────────────────────────────────────────────────────────
  if (phase === "done") {
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const maxScore = ROUNDS * 100;
    const pct = totalScore / maxScore;
    const grade = pct >= 0.9 ? "S" : pct >= 0.75 ? "A" : pct >= 0.6 ? "B" : pct >= 0.45 ? "C" : "D";

    return (
      <div className="fixed inset-0 bg-black flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="border-b border-white/10 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <span className="font-mono text-xs text-white/30 tracking-widest uppercase">PolitiGuessr</span>
          <AuthModal />
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
            </div>

            <div className="border-t border-white/10" />

            {/* Round breakdown */}
            <div className="divide-y divide-white/10 border border-white/10">
              {results.map((r, i) => {
                const loc = session!.rounds[i];
                return (
                  <div key={r.roundNumber} className="flex items-center px-3 py-2.5 gap-3">
                    <span className="font-mono text-xs text-white/20 w-4">0{r.roundNumber}</span>
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

            {/* Save status */}
            <div className="font-mono text-xs tracking-widest text-center py-1">
              {scoreSaved && <span className="text-white/40">Score saved ✓</span>}
              {scoreSaveError && <span className="text-red-400/60">Failed to save score</span>}
              {!user && !scoreSaved && (
                <span className="text-white/20">Sign in to save your score</span>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href="/"
                className="flex-1 border border-white/30 py-3 font-mono text-sm tracking-widest uppercase text-center text-white/50 hover:border-white hover:text-white transition-colors duration-150"
              >
                Home
              </a>
              <button
                onClick={startGame}
                className="flex-1 border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150"
              >
                Play Again →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing / Reveal ─────────────────────────────────────────────────────
  const round = session!.rounds[currentRound];
  const totalScore = results.reduce((s, r) => s + r.score, 0);

  return (
    <div className="fixed inset-0">
      {/* Street View */}
      <StreetViewPanorama lat={round.lat} lng={round.lng} heading={round.heading} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10">
        <span className="font-mono text-xs tracking-widest text-white/50 uppercase">
          Round <span className="text-white">{String(currentRound + 1).padStart(2, "0")}</span>/{ROUNDS}
        </span>
        <CountdownTimer
          key={timerKey}
          seconds={ROUND_SECONDS}
          onExpire={() => submitGuess(guessedMargin, true)}
          paused={timerPaused || devMode}
        />
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tracking-widest text-white/50 uppercase">
            Score <span className="text-white">{String(totalScore).padStart(3, "0")}</span>
          </span>
          <AuthModal />
          <button
            onClick={() => setDevMode((d) => !d)}
            className={`font-mono text-xs px-1.5 py-0.5 border tracking-widest transition-colors ${devMode ? "border-yellow-400 text-yellow-400" : "border-white/10 text-white/20 hover:text-white/40"}`}
          >
            DEV
          </button>
        </div>
      </div>

      {/* Guess panel */}
      {phase === "playing" && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pb-6 px-4">
          <div className="w-full max-w-md bg-black border border-white/20 p-5 space-y-4">
            <p className="font-mono text-xs text-white/30 tracking-widest uppercase text-center">
              How did this county vote?
            </p>
            <MarginSlider value={guessedMargin} onChange={setGuessedMargin} />
            <button
              onClick={() => submitGuess(guessedMargin)}
              className="w-full border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150"
            >
              Lock In
            </button>
          </div>
        </div>
      )}

      {/* Reveal panel */}
      {phase === "reveal" && currentResult && (
        <RevealPanel
          result={currentResult}
          onAdvance={advance}
          isLastRound={currentRound + 1 >= ROUNDS}
          autoAdvanceCountdown={autoAdvanceCountdown}
        />
      )}
    </div>
  );
}

// ── Reveal ────────────────────────────────────────────────────────────────

interface RevealPanelProps {
  result: RoundResult;
  onAdvance: () => void;
  isLastRound: boolean;
  autoAdvanceCountdown: number | null;
}

function RevealPanel({ result, onAdvance, isLastRound, autoAdvanceCountdown }: RevealPanelProps) {
  const isRed = result.actualMargin > 0.5;
  const isBlue = result.actualMargin < -0.5;
  const diff = Math.abs(result.actualMargin - result.guessedMargin);
  const gotPartyRight =
    (result.actualMargin > 0.5 && result.guessedMargin > 0.5) ||
    (result.actualMargin < -0.5 && result.guessedMargin < -0.5) ||
    (Math.abs(result.actualMargin) <= 0.5 && Math.abs(result.guessedMargin) <= 0.5);
  const accuracy = !gotPartyRight
    ? "Wrong party"
    : diff < 5
    ? "Nailed it"
    : diff < 15
    ? "Correct"
    : "Right party";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-black border border-white/20">
        {/* Map */}
        <div className="border-b border-white/10 bg-[#0a0a0a]" style={{ height: 180 }}>
          <CountyMap fips={result.fips} className="w-full h-full" />
        </div>

        {/* County + result */}
        <div className="px-5 pt-4 pb-2 border-b border-white/10 space-y-0.5">
          {result.timedOut && (
            <p className="font-mono text-xs text-yellow-400 tracking-widest uppercase mb-2">⏱ Time&apos;s up</p>
          )}
          <h2 className="text-2xl font-bold leading-tight tracking-tight">{result.county}</h2>
          {result.town && (
            <p className="font-mono text-xs text-white/60 tracking-wider">{result.town}</p>
          )}
          <p className="font-mono text-xs text-white/40 tracking-wider uppercase">{result.state}</p>
          <p className={`text-4xl font-bold tabular-nums mt-2 ${isRed ? "text-red-500" : isBlue ? "text-blue-500" : "text-white/50"}`}>
            {formatMargin(result.actualMargin)}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-white/10 border-b border-white/10">
          {[
            { label: "Your Guess", value: formatMargin(result.guessedMargin), color: marginColor(result.guessedMargin) },
            { label: accuracy, value: `+${result.score}`, color: result.score >= 80 ? "text-white" : result.score >= 50 ? "text-white/60" : "text-white/30" },
            { label: `Off by`, value: `${diff.toFixed(1)}`, color: "text-white/50" },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-3 py-3 text-center space-y-1">
              <p className="font-mono text-xs text-white/25 tracking-wider uppercase leading-tight">{label}</p>
              <p className={`font-mono text-sm font-bold tabular-nums ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Next button */}
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

import type { RoundPublic } from "@/lib/types";

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
          {/* Bar */}
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
          {/* Panorama */}
          <div className="flex-1">
            <StreetViewPanorama lat={loc.lat} lng={loc.lng} heading={loc.heading} />
          </div>
        </div>
      )}
    </>
  );
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
