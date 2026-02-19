import { NextRequest, NextResponse } from "next/server";
import { scoreGuess } from "@/lib/gameStore";
import type { GuessPayload } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GuessPayload;
    const { sessionId, roundNumber, guessedMargin } = body;

    if (!sessionId || roundNumber == null || guessedMargin == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const result = scoreGuess(sessionId, roundNumber, guessedMargin);
    if (!result) {
      return NextResponse.json({ error: "Session not found or invalid round" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("/api/guess error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
