import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      {/* Masthead */}
      <div className="border-b border-white/20 px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-xs text-white/40 tracking-widest uppercase">Est. 2024</span>
        <span className="font-mono text-xs text-white/40 tracking-widest uppercase">United States</span>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-2xl mx-auto w-full">
        <div className="w-full space-y-8">

          {/* Title */}
          <div>
            <h1 className="text-[clamp(3rem,12vw,7rem)] font-bold leading-none tracking-tight uppercase">
              Politi
              <br />
              Guessr
            </h1>
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
              ["02", "Slide from D+50 to R+50. Make your call."],
              ["03", "15 seconds per round. Five rounds. Max 500 pts."],
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
