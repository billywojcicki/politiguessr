"use client";

interface MarginSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function formatMargin(margin: number): string {
  if (Math.abs(margin) < 0.5) return "SPLIT";
  if (margin > 0) return `R+${Math.abs(margin).toFixed(1)}`;
  return `D+${Math.abs(margin).toFixed(1)}`;
}

export function marginColor(margin: number): string {
  if (Math.abs(margin) < 0.5) return "text-white/60";
  if (margin > 0) return "text-red-500";
  return "text-blue-500";
}

const TICKS = [-50, -25, 0, 25, 50];

export default function MarginSlider({ value, onChange, disabled }: MarginSliderProps) {
  const pct = (value + 50) / 100; // 0–1
  const isRed = value > 0.5;
  const isBlue = value < -0.5;

  return (
    <div className="w-full space-y-3 font-mono">
      {/* Current value */}
      <div className="text-center">
        <span className={`text-3xl font-bold tabular-nums tracking-tight ${isRed ? "text-red-500" : isBlue ? "text-blue-500" : "text-white/50"}`}>
          {formatMargin(value)}
        </span>
      </div>

      {/* Track */}
      <div className="relative py-3">
        {/* Base line */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/20" />

        {/* Colored fill from center */}
        <div
          className={`absolute top-1/2 h-px ${isRed ? "bg-red-500" : isBlue ? "bg-blue-500" : "bg-white/40"}`}
          style={{
            left: isBlue ? `${pct * 100}%` : "50%",
            right: isRed ? `${(1 - pct) * 100}%` : "50%",
          }}
        />

        {/* Tick marks */}
        {TICKS.map((t) => {
          const tp = (t + 50) / 100;
          return (
            <div
              key={t}
              className="absolute top-1/2 -translate-y-1/2 w-px h-2 bg-white/30"
              style={{ left: `${tp * 100}%` }}
            />
          );
        })}

        {/* Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 border-2 ${isRed ? "border-red-500 bg-red-500" : isBlue ? "border-blue-500 bg-blue-500" : "border-white bg-black"} pointer-events-none`}
          style={{ left: `calc(${pct * 100}% - 6px)` }}
        />

        {/* Invisible input */}
        <input
          type="range"
          min={-50}
          max={50}
          step={0.5}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default"
          style={{ margin: 0, height: "100%" }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-white/30 tracking-widest uppercase">
        <span>D+50</span>
        <span>SPLIT</span>
        <span>R+50</span>
      </div>
    </div>
  );
}
