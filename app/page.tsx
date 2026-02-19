import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-lg space-y-8">
        {/* Logo / Title */}
        <div className="space-y-3">
          <h1 className="text-6xl font-black tracking-tight">
            <span className="text-blue-400">Politi</span>
            <span className="text-red-400">Guessr</span>
          </h1>
          <p className="text-gray-400 text-xl">
            Can you tell how a county voted just by looking at it?
          </p>
        </div>

        {/* How to play */}
        <div className="bg-gray-900 rounded-2xl p-6 space-y-4 text-left">
          <h2 className="text-lg font-bold text-gray-200">How to play</h2>
          <ol className="space-y-3 text-gray-400">
            <li className="flex gap-3">
              <span className="text-2xl leading-none">🌍</span>
              <span>You'll see a Street View image of a random US location</span>
            </li>
            <li className="flex gap-3">
              <span className="text-2xl leading-none">🗳️</span>
              <span>
                Guess how the county voted in the 2024 presidential election — from{" "}
                <span className="text-blue-400 font-semibold">D+50</span> to{" "}
                <span className="text-red-400 font-semibold">R+50</span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-2xl leading-none">⏱️</span>
              <span>You have 15 seconds per round — 5 rounds total</span>
            </li>
            <li className="flex gap-3">
              <span className="text-2xl leading-none">🎯</span>
              <span>
                Score up to <strong className="text-white">100 points</strong> per round — the
                closer your guess, the higher your score
              </span>
            </li>
          </ol>
        </div>

        <Link
          href="/play"
          className="block w-full py-5 bg-white text-gray-900 font-black text-2xl rounded-2xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg"
        >
          Play →
        </Link>

        <p className="text-gray-600 text-xs">
          Data: 2024 US Presidential Election results · Google Street View
        </p>
      </div>
    </main>
  );
}
