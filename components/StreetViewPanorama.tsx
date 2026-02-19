"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  lat: number;
  lng: number;
  heading: number;
}

// Singleton loader — only inserts the script tag once
let mapsLoaderPromise: Promise<void> | null = null;

function loadMapsApi(): Promise<void> {
  if (mapsLoaderPromise) return mapsLoaderPromise;

  mapsLoaderPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject("No window");
    if (window.google?.maps) return resolve();

    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Maps API"));
    document.head.appendChild(script);
  });

  return mapsLoaderPromise;
}

export default function StreetViewPanorama({ lat, lng, heading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Initialize panorama once
  useEffect(() => {
    let cancelled = false;

    loadMapsApi()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const pano = new google.maps.StreetViewPanorama(containerRef.current, {
          position: { lat, lng },
          pov: { heading, pitch: 0 },
          zoom: 0,
          // Anti-cheat: hide controls that reveal location
          addressControl: false,
          linksControl: false,       // no walking arrows
          clickToGo: false,          // no click-to-walk
          panControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          fullscreenControl: false,
          // Allow look-around
          scrollwheel: true,
          enableCloseButton: false,
        });

        // Listen for the panorama to finish loading
        google.maps.event.addListenerOnce(pano, "status_changed", () => {
          if (cancelled) return;
          const s = pano.getStatus();
          setStatus(s === google.maps.StreetViewStatus.OK ? "ready" : "error");
        });

        panoramaRef.current = pano;
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // Only run once on mount — location changes handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update position when the round changes
  useEffect(() => {
    const pano = panoramaRef.current;
    if (!pano) return;

    setStatus("loading");
    pano.setPosition({ lat, lng });
    pano.setPov({ heading, pitch: 0 });
    pano.setZoom(0);

    const listener = google.maps.event.addListenerOnce(pano, "status_changed", () => {
      const s = pano.getStatus();
      setStatus(s === google.maps.StreetViewStatus.OK ? "ready" : "error");
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [lat, lng, heading]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 pointer-events-none">
          <p className="text-gray-500 text-sm animate-pulse">Loading Street View…</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 pointer-events-none">
          <p className="text-gray-500 text-sm">No Street View available here</p>
        </div>
      )}
    </div>
  );
}
