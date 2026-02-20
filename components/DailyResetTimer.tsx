"use client";

import { useEffect, useState } from "react";

function getTimeUntilReset() {
  const now = new Date();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DailyResetTimer() {
  const [time, setTime] = useState(getTimeUntilReset());

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeUntilReset()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="font-mono text-xs text-white/20 tracking-widest text-center uppercase">
      Resets in <span className="tabular-nums">{time}</span>
    </p>
  );
}
