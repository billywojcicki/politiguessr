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

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (paused) return;
    if (remaining <= 0) {
      onExpireRef.current();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, paused]);

  const pct = remaining / seconds;
  const color =
    pct > 0.5 ? "text-green-400" : pct > 0.25 ? "text-yellow-400" : "text-red-400";
  const ringColor =
    pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#f87171";

  const circumference = 2 * Math.PI * 20;
  const strokeDash = circumference * pct;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#374151" strokeWidth="4" />
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s" }}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums ${color}`}
        >
          {remaining}
        </span>
      </div>
    </div>
  );
}
