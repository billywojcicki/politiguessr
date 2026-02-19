"use client";

import { useEffect, useState, useRef } from "react";

interface CountdownTimerProps {
  seconds: number;
  onExpire: () => void;
  paused?: boolean;
}

export default function CountdownTimer({ seconds, onExpire, paused }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => { setRemaining(seconds); }, [seconds]);

  useEffect(() => {
    if (paused) return;
    if (remaining <= 0) { onExpireRef.current(); return; }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, paused]);

  const pct = remaining / seconds;
  const urgent = pct <= 0.25;
  const warning = pct <= 0.5;

  return (
    <div className="flex flex-col items-center gap-1 font-mono">
      <span className={`text-2xl font-bold tabular-nums leading-none ${urgent ? "text-red-500" : warning ? "text-yellow-400" : "text-white"}`}>
        {String(remaining).padStart(2, "0")}
      </span>
      {/* Draining bar */}
      <div className="w-8 h-px bg-white/20">
        <div
          className={`h-full transition-all duration-1000 ${urgent ? "bg-red-500" : warning ? "bg-yellow-400" : "bg-white"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
