"use client";

import { useState } from "react";

export default function DatasetSelector() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-white mt-4 pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between group"
      >
        <span className="font-mono text-sm text-white/60 tracking-wide uppercase group-hover:text-white/80 transition-colors duration-150">
          2024 US Presidential Election Results
        </span>
        <span className={`font-mono text-white/40 group-hover:text-white/60 transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="mt-3 border border-white/10 divide-y divide-white/10">
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="font-mono text-xs text-white tracking-wide">2024 US Presidential</span>
            <span className="font-mono text-xs text-amber-400/60 tracking-widest uppercase">Active</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 opacity-40 cursor-not-allowed">
            <span className="font-mono text-xs text-white/60 tracking-wide">2020 US Presidential</span>
            <span className="font-mono text-xs text-white/25 tracking-widest uppercase">Coming soon</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 opacity-40 cursor-not-allowed">
            <span className="font-mono text-xs text-white/60 tracking-wide">2022 US Midterms</span>
            <span className="font-mono text-xs text-white/25 tracking-widest uppercase">Coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
}
