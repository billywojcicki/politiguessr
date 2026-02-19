/**
 * Server-side in-memory session store.
 * Uses globalThis to survive Next.js hot-module reloads in dev.
 */

import type { GuessResult } from "./types";

export interface SecretRound {
  roundNumber: number;
  fips: string;
  county: string;
  state: string;
  margin: number;
}

interface Session {
  id: string;
  rounds: SecretRound[];
  createdAt: number;
}

// Persist across HMR reloads in development
declare global {
  // eslint-disable-next-line no-var
  var __politiguessr_sessions: Map<string, Session> | undefined;
}

function getSessions(): Map<string, Session> {
  if (!globalThis.__politiguessr_sessions) {
    globalThis.__politiguessr_sessions = new Map();
  }
  return globalThis.__politiguessr_sessions;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

function purgeExpired() {
  const now = Date.now();
  const sessions = getSessions();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function createSession(id: string, rounds: SecretRound[]): void {
  purgeExpired();
  getSessions().set(id, { id, rounds, createdAt: Date.now() });
}

export function scoreGuess(
  sessionId: string,
  roundNumber: number,
  guessedMargin: number
): GuessResult | null {
  const session = getSessions().get(sessionId);
  if (!session) return null;

  const round = session.rounds.find((r) => r.roundNumber === roundNumber);
  if (!round) return null;

  const diff = Math.abs(round.margin - guessedMargin);
  const score = Math.max(0, Math.round(100 - diff));

  return {
    roundNumber,
    county: round.county,
    state: round.state,
    actualMargin: round.margin,
    guessedMargin,
    score,
  };
}
