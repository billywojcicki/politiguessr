import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/sessionToken";
import type { GuessPayload, GuessResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GuessPayload;
    const { sessionToken, roundNumber, guessedMargin } = body;

    if (!sessionToken || roundNumber == null || guessedMargin == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const rounds = verifyToken(sessionToken);
    if (!rounds) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    const round = rounds.find((r) => r.roundNumber === roundNumber);
    if (!round) {
      return NextResponse.json({ error: "Invalid round" }, { status: 400 });
    }

    const diff = Math.abs(round.margin - guessedMargin);
    const score = Math.max(0, Math.round(100 - diff));

    const result: GuessResult = {
      roundNumber,
      fips: round.fips,
      county: round.county,
      state: round.state,
      actualMargin: round.margin,
      guessedMargin,
      score,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("/api/guess error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
