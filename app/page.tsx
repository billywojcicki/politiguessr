import Link from "next/link";
import AuthModal from "@/components/AuthModal";

function AmericanFlag() {
  // Standard US flag proportions: 1.9:1
  // viewBox 190×100, 13 stripes, canton 76×53.85
  const stripeH = 100 / 13;
  const cantonW = 76;
  const cantonH = stripeH * 7;

  // 50 stars: 5 rows of 6, 4 rows of 5, alternating
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
      stars.push([
        starPadX + offsetX + col * gapX,
        starPadY + row * gapY,
      ]);
    }
  }

  return (
    <svg
      viewBox="0 0 190 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Stripes */}
      {Array.from({ length: 13 }, (_, i) => (
        <rect
          key={i}
          x={0} y={i * stripeH}
          width={190} height={stripeH}
          fill={i % 2 === 0 ? "#B22234" : "#FFFFFF"}
        />
      ))}
      {/* Canton */}
      <rect x={0} y={0} width={cantonW} height={cantonH} fill="#3C3B6E" />
      {/* Stars */}
      {stars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.1} fill="#FFFFFF" />
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
              <div className="absolute inset-0 opacity-20 pointer-events-none select-none overflow-hidden">
                <AmericanFlag />
              </div>
              {/* Title text */}
              <h1 className="relative text-[clamp(3rem,12vw,7rem)] font-bold leading-none tracking-tight uppercase">
                Politi
                <br />
                Guessr
              </h1>
            </div>
            <div className="border-t border-white mt-4 pt-4">
              <p className="font-mono text-sm text-white/60 tracking-wide uppercase">
                Guess the county. Read the landscape.
              </p>
            </div>
          </div>

          {/* Rules */}
          <div className="border border-white/20 divide-y divide-white/10">
            {[
              ["01", "A Street View image. Anywhere in America."],
              ["02", "Slide from D+100 to R+100. Make your call."],
              ["03", "30 seconds per round. Five rounds. Max 500 pts."],
            ].map(([n, text]) => (
              <div key={n} className="flex gap-4 px-4 py-3">
                <span className="font-mono text-xs text-white/30 pt-0.5 w-5 flex-shrink-0">{n}</span>
                <span className="text-sm text-white/70">{text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/play"
            className="block w-full border border-white py-4 text-center font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150"
          >
            Play →
          </Link>

          {/* Footer note */}
          <p className="font-mono text-xs text-white/20 text-center tracking-wider uppercase">
            2024 Presidential Results · Google Street View
          </p>
        </div>
      </div>
    </main>
  );
}
