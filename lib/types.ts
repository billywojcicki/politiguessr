export interface ElectionResult {
  fips: string;
  county: string;
  state: string;
  totalVotes: number;
  demVotes: number;
  gopVotes: number;
  demPct: number;
  gopPct: number;
  /** R% - D%, positive = red, negative = blue */
  margin: number;
}

export interface Location {
  lat: number;
  lng: number;
  fips: string;
  heading: number;
}

export interface GameRound {
  roundNumber: number;
  /** Street View image URL — safe to expose to client */
  streetViewUrl: string;
  /** Hidden from client until reveal */
  _secret: {
    fips: string;
    county: string;
    state: string;
    margin: number;
  };
}

/** What the /api/game route returns for a new game */
export interface GameSession {
  sessionId: string;
  rounds: RoundPublic[];
}

/** Public round data sent to client — no answer */
export interface RoundPublic {
  roundNumber: number;
  streetViewUrl: string;
  lat: number;
  lng: number;
  heading: number;
}

/** Sent from client when submitting a guess */
export interface GuessPayload {
  sessionId: string;
  roundNumber: number;
  guessedMargin: number;
}

/** Returned after a guess is submitted */
export interface GuessResult {
  roundNumber: number;
  county: string;
  state: string;
  actualMargin: number;
  guessedMargin: number;
  score: number;
}
