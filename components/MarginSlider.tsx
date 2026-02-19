"use client";

interface MarginSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Formats margin as D+X or R+X or EVEN */
export function formatMargin(margin: number): string {
  if (Math.abs(margin) < 0.5) return "EVEN";
  if (margin > 0) return `R+${Math.abs(margin).toFixed(1)}`;
  return `D+${Math.abs(margin).toFixed(1)}`;
}

export function marginColor(margin: number): string {
  if (Math.abs(margin) < 0.5) return "text-purple-300";
  if (margin > 0) return "text-red-400";
  return "text-blue-400";
}

export default function MarginSlider({ value, onChange, disabled }: MarginSliderProps) {
  // slider range: -50 (D+50) to +50 (R+50), step 0.5
  const pct = (value + 50) / 100; // 0–1

  return (
    <div className="w-full space-y-3">
      {/* Labels */}
      <div className="flex justify-between text-xs font-semibold">
        <span className="text-blue-400">D+50</span>
        <span className="text-purple-300">EVEN</span>
        <span className="text-red-400">R+50</span>
      </div>

      {/* Gradient track + input */}
      <div className="relative">
        <div
          className="h-3 rounded-full w-full"
          style={{
            background:
              "linear-gradient(to right, #3b82f6, #7c3aed, #ef4444)",
          }}
        />
        <input
          type="range"
          min={-50}
          max={50}
          step={0.5}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="absolute inset-0 w-full h-3 opacity-0 cursor-pointer disabled:cursor-default"
          style={{ margin: 0 }}
        />
        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none transition-all"
          style={{
            left: `calc(${pct * 100}% - 10px)`,
            background: `hsl(${240 - pct * 240}, 80%, 55%)`,
          }}
        />
      </div>

      {/* Current value */}
      <div className="text-center">
        <span
          className={`text-2xl font-bold tabular-nums transition-colors ${marginColor(value)}`}
        >
          {formatMargin(value)}
        </span>
      </div>
    </div>
  );
}
