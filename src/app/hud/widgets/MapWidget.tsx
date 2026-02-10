"use client";

import { useState, useEffect } from "react";

const HAS_GOOGLE_MAPS = typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === "string" &&
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.length > 0;

export default function MapWidget() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/telemetry/latest")
        .then((r) => r.json())
        .then((data) => {
          if (data.lat != null && data.lon != null) {
            setLat(data.lat);
            setLon(data.lon);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!HAS_GOOGLE_MAPS) {
    return (
      <div className="bg-black/60 text-white rounded-lg p-3 h-full flex items-center justify-center text-sm">
        Map placeholder (set GOOGLE_MAPS_API_KEY)
      </div>
    );
  }

  if (lat == null || lon == null) {
    return (
      <div className="bg-black/60 text-white rounded-lg p-3 h-full flex items-center justify-center text-sm">
        Waiting for location…
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&center=${lat},${lon}&zoom=15`;
  return (
    <div className="bg-black/60 rounded-lg overflow-hidden h-full w-full">
      <iframe
        title="Map"
        src={src}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
