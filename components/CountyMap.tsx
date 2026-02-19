"use client";

import { useEffect, useState } from "react";

interface Props {
  fips: string;
  className?: string;
}

export default function CountyMap({ fips, className = "" }: Props) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    setSvg(null); // clear immediately — shows skeleton instead of stale map
    let cancelled = false;
    fetch(`/api/county-map?fips=${fips}`)
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => { if (!cancelled) setSvg(text ?? ""); })
      .catch(() => { if (!cancelled) setSvg(""); });
    return () => { cancelled = true; };
  }, [fips]);

  if (svg === null) {
    return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />;
  }

  if (svg === "") return null;

  return (
    <div
      className={`overflow-hidden ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
