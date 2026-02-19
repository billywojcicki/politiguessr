"use client";

import { useState, useCallback, useEffect } from "react";
import MarginSlider, { formatMargin, marginColor } from "./MarginSlider";
import CountdownTimer from "./CountdownTimer";
import StreetViewPanorama from "./StreetViewPanorama";
import CountyMap from "./CountyMap";
import type { GameSession, GuessResult } from "@/lib/types";

const ROUNDS = 5;
const ROUND_SECONDS = 15;

type Phase = "loading" | "playing" | "reveal" | "done";

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

  const startGame = useCallback(async () => {
    setPhase("loading");
    setResults([]);
    setCurrentRound(0);
    setGuessedMargin(0);

    const res = await fetch("/api/game");
    if (!res.ok) return;
    const data = (await res.json()) as GameSession;
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
        body: JSON.stringify({
          sessionId: session.sessionId,
          roundNumber: round.roundNumber,
          guessedMargin: margin,
        }),
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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-pulse">🗺️</div>
          <p className="text-gray-400 text-lg">Loading game…</p>
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
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950 p-4 overflow-y-auto">
        <div className="max-w-lg w-full space-y-6 py-8">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black">Final Score</h2>
            <div className="text-7xl font-black tabular-nums">
              <span className={pct >= 0.9 ? "text-yellow-400" : pct >= 0.6 ? "text-green-400" : "text-red-400"}>
                {totalScore}
              </span>
              <span className="text-gray-500 text-4xl">/{maxScore}</span>
            </div>
            <div className="text-6xl font-black text-gray-300">Grade {grade}</div>
          </div>

          <div className="bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-800">
            {results.map((r) => (
              <div key={r.roundNumber} className="flex items-center px-4 py-3 gap-3">
                <span className="text-gray-500 text-sm w-5">#{r.roundNumber}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{r.county}, {stateAbbr(r.state)}</div>
                  <div className="text-xs text-gray-400 flex gap-2">
                    <span>Actual: <span className={marginColor(r.actualMargin)}>{formatMargin(r.actualMargin)}</span></span>
                    <span>·</span>
                    <span>Guess: <span className={marginColor(r.guessedMargin)}>{formatMargin(r.guessedMargin)}</span></span>
                  </div>
                </div>
                <div className={`text-lg font-bold tabular-nums ${r.score >= 80 ? "text-green-400" : r.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  {r.score}
                </div>
              </div>
            ))}
          </div>

          <button onClick={startGame} className="w-full py-4 bg-white text-gray-900 font-black text-xl rounded-xl hover:bg-gray-100 active:scale-95 transition-all">
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // ── Playing / Reveal ─────────────────────────────────────────────────────
  const round = session!.rounds[currentRound];
  const totalScore = results.reduce((s, r) => s + r.score, 0);

  return (
    <div className="fixed inset-0">
      {/* Street View fills the full screen */}
      <StreetViewPanorama lat={round.lat} lng={round.lng} heading={round.heading} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="text-sm text-gray-300 font-medium">
          Round <span className="text-white font-bold">{currentRound + 1}</span> of {ROUNDS}
        </div>
        <div className="pointer-events-auto">
          <CountdownTimer
            key={timerKey}
            seconds={ROUND_SECONDS}
            onExpire={() => submitGuess(guessedMargin, true)}
            paused={timerPaused || devMode}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-300 font-medium">
            Score: <span className="text-white font-bold">{totalScore}</span>
          </div>
          <button
            onClick={() => setDevMode((d) => !d)}
            title="Toggle dev mode (disables timer)"
            className={`pointer-events-auto text-xs px-2 py-0.5 rounded font-mono border transition-colors ${
              devMode
                ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400"
                : "bg-black/30 border-white/20 text-white/30 hover:text-white/60"
            }`}
          >
            DEV
          </button>
        </div>
      </div>

      {/* Guess controls — playing phase only */}
      {phase === "playing" && (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center pb-6 px-4">
          <div className="w-full max-w-md bg-black/75 backdrop-blur-sm rounded-2xl p-4 space-y-4 border border-white/10">
            <p className="text-center text-gray-300 text-sm font-medium">How did this county vote in 2024?</p>
            <MarginSlider value={guessedMargin} onChange={setGuessedMargin} />
            <button
              onClick={() => submitGuess(guessedMargin)}
              className="w-full py-3 bg-white text-gray-900 font-bold text-lg rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
            >
              Lock In
            </button>
          </div>
        </div>
      )}

      {/* Big centered reveal */}
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

interface RevealPanelProps {
  result: RoundResult;
  onAdvance: () => void;
  isLastRound: boolean;
  autoAdvanceCountdown: number | null;
}

function RevealPanel({ result, onAdvance, isLastRound, autoAdvanceCountdown }: RevealPanelProps) {
  const isRed = result.actualMargin > 0.5;
  const isBlue = result.actualMargin < -0.5;
  const accentColor = isRed ? "text-red-400" : isBlue ? "text-blue-400" : "text-purple-300";
  const diff = Math.abs(result.actualMargin - result.guessedMargin);
  const accuracy = diff < 2 ? "Incredible!" : diff < 5 ? "Very close!" : diff < 15 ? "Nice try" : "Way off";

  return (
    /* Full-screen dim backdrop */
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-gray-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">

        {/* State map — full width, tall */}
        <div className="relative w-full bg-gray-900" style={{ height: 200 }}>
          <CountyMap fips={result.fips} className="w-full h-full" />
          {/* Timed-out badge */}
          {result.timedOut && (
            <div className="absolute top-2 left-2 bg-black/70 text-yellow-400 text-xs font-bold px-2 py-1 rounded">
              ⏱ Time&apos;s up
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* County + state + actual result */}
          <div className="text-center space-y-0.5">
            <div className="text-3xl font-black text-white leading-tight">{result.county}</div>
            <div className="text-lg text-gray-400">{result.state}</div>
            <div className={`text-5xl font-black mt-2 ${accentColor}`}>
              {formatMargin(result.actualMargin)}
            </div>
          </div>

          {/* Guess vs actual */}
          <div className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3">
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your guess</div>
              <div className={`text-xl font-bold ${marginColor(result.guessedMargin)}`}>
                {formatMargin(result.guessedMargin)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{accuracy}</div>
              <div className={`text-4xl font-black ${result.score >= 80 ? "text-green-400" : result.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                +{result.score}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">off by {diff.toFixed(1)} pts</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Actual</div>
              <div className={`text-xl font-bold ${accentColor}`}>
                {formatMargin(result.actualMargin)}
              </div>
            </div>
          </div>

          {/* Next button */}
          <button
            onClick={onAdvance}
            className="w-full py-3 bg-white text-gray-900 font-black text-lg rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
          >
            {isLastRound
              ? "See Results"
              : `Next Round${autoAdvanceCountdown !== null ? ` (${autoAdvanceCountdown})` : ""}`}
          </button>
        </div>
      </div>
    </div>
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
