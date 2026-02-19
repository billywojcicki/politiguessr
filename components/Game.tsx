"use client";

import { useState, useCallback, useEffect } from "react";
import MarginSlider, { formatMargin, marginColor } from "./MarginSlider";
import CountdownTimer from "./CountdownTimer";
import StreetViewPanorama from "./StreetViewPanorama";
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
  const [currentRound, setCurrentRound] = useState(0); // 0-indexed
  const [guessedMargin, setGuessedMargin] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);

  const startGame = useCallback(async () => {
    setPhase("loading");
    setResults([]);
    setCurrentRound(0);
    setGuessedMargin(0);

    const res = await fetch("/api/game");
    if (!res.ok) {
      console.error("Failed to start game");
      return;
    }
    const data = (await res.json()) as GameSession;
    setSession(data);
    setTimerKey((k) => k + 1);
    setTimerPaused(false);
    setPhase("playing");
  }, []);

  useEffect(() => {
    startGame();
  }, [startGame]);

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

      if (!res.ok) {
        console.error("Failed to submit guess");
        return;
      }

      const result = (await res.json()) as GuessResult;
      const roundResult: RoundResult = { ...result, timedOut };
      setCurrentResult(roundResult);
      setResults((prev) => [...prev, roundResult]);

      // Auto-advance after 3s
      setAutoAdvanceCountdown(3);
    },
    [session, phase, currentRound]
  );

  // Auto-advance countdown
  useEffect(() => {
    if (autoAdvanceCountdown === null) return;
    if (autoAdvanceCountdown <= 0) {
      setAutoAdvanceCountdown(null);
      advance();
      return;
    }
    const id = setTimeout(() => setAutoAdvanceCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceCountdown]);

  const advance = useCallback(() => {
    setAutoAdvanceCountdown(null);
    const nextRound = currentRound + 1;
    if (nextRound >= ROUNDS) {
      setPhase("done");
    } else {
      setCurrentRound(nextRound);
      setGuessedMargin(0);
      setTimerKey((k) => k + 1);
      setTimerPaused(false);
      setPhase("playing");
    }
  }, [currentRound]);

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-4xl animate-pulse">🗺️</div>
          <p className="text-gray-400 text-lg">Loading game…</p>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const maxScore = ROUNDS * 100;
    const pct = totalScore / maxScore;
    const grade =
      pct >= 0.9 ? "S" : pct >= 0.75 ? "A" : pct >= 0.6 ? "B" : pct >= 0.45 ? "C" : "D";

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black">Final Score</h2>
            <div className="text-7xl font-black tabular-nums">
              <span
                className={
                  pct >= 0.9
                    ? "text-yellow-400"
                    : pct >= 0.6
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
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
                  <div className="font-semibold text-sm truncate">
                    {r.county}, {stateAbbr(r.state)}
                  </div>
                  <div className="text-xs text-gray-400 flex gap-2">
                    <span>
                      Actual:{" "}
                      <span className={marginColor(r.actualMargin)}>
                        {formatMargin(r.actualMargin)}
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      Guess:{" "}
                      <span className={marginColor(r.guessedMargin)}>
                        {formatMargin(r.guessedMargin)}
                      </span>
                    </span>
                  </div>
                </div>
                <div
                  className={`text-lg font-bold tabular-nums ${
                    r.score >= 80
                      ? "text-green-400"
                      : r.score >= 50
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {r.score}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-white text-gray-900 font-black text-xl rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  const round = session!.rounds[currentRound];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400 font-medium">
            Round{" "}
            <span className="text-white font-bold">{currentRound + 1}</span>{" "}
            of {ROUNDS}
          </div>
          <CountdownTimer
            key={timerKey}
            seconds={ROUND_SECONDS}
            onExpire={() => submitGuess(guessedMargin, true)}
            paused={timerPaused}
          />
          <div className="text-sm text-gray-400 font-medium">
            Score:{" "}
            <span className="text-white font-bold">
              {results.reduce((s, r) => s + r.score, 0)}
            </span>
          </div>
        </div>

        {/* Street View */}
        <div className="relative w-full rounded-xl overflow-hidden bg-gray-900 aspect-[16/10]">
          <StreetViewPanorama
            lat={round.lat}
            lng={round.lng}
            heading={round.heading}
          />

          {/* Reveal overlay */}
          {phase === "reveal" && currentResult && (
            <RevealOverlay result={currentResult} />
          )}
        </div>

        {/* Slider or reveal info */}
        {phase === "playing" ? (
          <div className="bg-gray-900 rounded-xl p-5 space-y-5">
            <p className="text-center text-gray-300 text-sm font-medium">
              How did this county vote in 2024?
            </p>
            <MarginSlider
              value={guessedMargin}
              onChange={setGuessedMargin}
            />
            <button
              onClick={() => submitGuess(guessedMargin)}
              className="w-full py-3 bg-white text-gray-900 font-bold text-lg rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
            >
              Lock In
            </button>
          </div>
        ) : (
          phase === "reveal" && currentResult && (
            <div className="bg-gray-900 rounded-xl p-5 space-y-4">
              <ScoreSummary result={currentResult} />
              <button
                onClick={advance}
                className="w-full py-3 bg-white text-gray-900 font-bold text-lg rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
              >
                {currentRound + 1 >= ROUNDS ? "See Results" : `Next Round${autoAdvanceCountdown !== null ? ` (${autoAdvanceCountdown})` : ""}`}
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function RevealOverlay({ result }: { result: RoundResult }) {
  const isRed = result.actualMargin > 0.5;
  const isBlue = result.actualMargin < -0.5;

  return (
    <div className="absolute inset-0 bg-black/60 flex items-end p-4">
      <div className="text-white">
        <div className="text-xs uppercase tracking-widest text-gray-300 mb-1">
          {result.timedOut ? "⏱ Time's up!" : "Locked in!"}
        </div>
        <div className="text-2xl font-black leading-tight">
          {result.county}
        </div>
        <div className="text-sm text-gray-300">{result.state}</div>
        <div
          className={`text-3xl font-black mt-1 ${
            isRed ? "text-red-400" : isBlue ? "text-blue-400" : "text-purple-300"
          }`}
        >
          {formatMargin(result.actualMargin)}
        </div>
      </div>
    </div>
  );
}

function ScoreSummary({ result }: { result: RoundResult }) {
  const diff = Math.abs(result.actualMargin - result.guessedMargin);
  const accuracy =
    diff < 2 ? "Incredible!" : diff < 5 ? "Very close!" : diff < 15 ? "Nice try" : "Way off";

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Your guess</div>
          <div className={`text-xl font-bold ${marginColor(result.guessedMargin)}`}>
            {formatMargin(result.guessedMargin)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{accuracy}</div>
          <div
            className={`text-4xl font-black ${
              result.score >= 80
                ? "text-green-400"
                : result.score >= 50
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            +{result.score}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Actual</div>
          <div className={`text-xl font-bold ${marginColor(result.actualMargin)}`}>
            {formatMargin(result.actualMargin)}
          </div>
        </div>
      </div>

      <div className="h-px bg-gray-800" />
      <div className="flex justify-between text-sm text-gray-400">
        <span>Off by {diff.toFixed(1)} points</span>
      </div>
    </div>
  );
}

/** Convert full state name to abbreviation — falls back to the full name */
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
    "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
    "District of Columbia": "DC",
  };
  return map[stateName] ?? stateName;
}
