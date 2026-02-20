import Link from "next/link";
import AuthModal from "@/components/AuthModal";
import HomeLeaderboard from "@/components/HomeLeaderboard";
import DatasetSelector from "@/components/DatasetSelector";

function AmericanFlag() {
  const stripeH = 100 / 13;
  const cantonW = 76;
  const cantonH = stripeH * 7;

  // 5-pointed star polygon points centered at origin
  const R = 1.5; // outer radius
  const r = R * 0.4; // inner radius
  const starPoints = Array.from({ length: 10 }, (_, i) => {
    const angle = (i * 36 - 90) * Math.PI / 180;
    const radius = i % 2 === 0 ? R : r;
    return `${(radius * Math.cos(angle)).toFixed(3)},${(radius * Math.sin(angle)).toFixed(3)}`;
  }).join(" ");

  // 50 stars: 6 cols × 5 rows + 5 cols × 4 rows, alternating
  const stars: [number, number][] = [];
  const colsA = 6; const colsB = 5;
  const rows = 9;
  const starPadX = cantonW * 0.1;
  const starPadY = cantonH * 0.1;
  const gapX = (cantonW - 2 * starPadX) / (colsA - 1);
  const gapY = (cantonH - 2 * starPadY) / (rows - 1);

  for (let row = 0; row < rows; row++) {
    const cols = row % 2 === 0 ? colsA : colsB;
    const offsetX = row % 2 === 0 ? 0 : gapX / 2;
    for (let col = 0; col < cols; col++) {
      stars.push([starPadX + offsetX + col * gapX, starPadY + row * gapY]);
    }
  }

  return (
    <svg
      viewBox="0 0 190 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <polygon id="star" points={starPoints} fill="#FFFFFF" />
      </defs>
      {/* Stripes */}
      {Array.from({ length: 13 }, (_, i) => (
        <rect key={i} x={0} y={i * stripeH} width={190} height={stripeH}
          fill={i % 2 === 0 ? "#B22234" : "#FFFFFF"} />
      ))}
      {/* Canton */}
      <rect x={0} y={0} width={cantonW} height={cantonH} fill="#3C3B6E" />
      {/* Stars */}
      {stars.map(([x, y], i) => (
        <use key={i} href="#star" transform={`translate(${x},${y})`} />
      ))}
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      {/* Masthead */}
      <div className="border-b border-white/20 px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-xs text-white/40 tracking-widest uppercase">Est. 2024</span>
        <AuthModal />
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-2xl mx-auto w-full">
        <div className="w-full space-y-8">

          {/* Title with flag watermark */}
          <div>
            <div className="relative">
              {/* Flag — faded behind the text */}
              <div className="absolute inset-0 opacity-25 pointer-events-none select-none overflow-hidden">
                <AmericanFlag />
              </div>
              {/* Title text */}
              <h1 className="relative text-[clamp(3rem,12vw,7rem)] font-bold leading-none tracking-tight uppercase">
                Politi
                <br />
                Guessr
              </h1>
            </div>
            <DatasetSelector />
          </div>

          {/* Rules */}
          <div className="space-y-3">
          <p className="font-mono text-xs text-white/30 tracking-widest uppercase">How to play:</p>
          <div className="border border-white/20 divide-y divide-white/10">
            {[
              ["1", "Click around Google Street View"],
              ["2", "Guess how the county voted from D+100 to R+100"],
              ["3", "30 seconds/round, 5 rounds, 1000 pts max"],
            ].map(([n, text]) => (
              <div key={n} className="flex gap-4 px-4 py-3">
                <span className="font-mono text-xs text-white/30 pt-0.5 w-5 flex-shrink-0">{n}</span>
                <span className="text-sm text-white/70">{text}</span>
              </div>
            ))}
          </div>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Link
              href="/play"
              className="block w-full border border-white py-4 text-center font-mono text-sm tracking-widest uppercase text-white hover:bg-white hover:text-black"
            >
              Play →
            </Link>
            <Link
              href="/daily"
              className="block w-full border border-amber-400/60 py-4 text-center font-mono text-sm tracking-widest uppercase text-amber-400 hover:bg-amber-400 hover:text-black"
            >
              Daily Challenge →
            </Link>
          </div>

          {/* Today's leaderboard */}
          <HomeLeaderboard />

          {/* Footer note */}
          <p className="font-mono text-xs text-white/20 text-center tracking-wider uppercase">
            2024 Presidential Results · Google Street View
          </p>
        </div>
      </div>
    </main>
  );
}
