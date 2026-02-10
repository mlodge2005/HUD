"use client";

import { useState, useEffect } from "react";

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function headingToCardinal(deg: number): string {
  const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return CARDINALS[i];
}

export default function CompassWidget() {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/telemetry/latest")
        .then((r) => r.json())
        .then((data) => {
          if (data.headingDeg != null) setHeading(data.headingDeg);
        })
        .catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (heading == null) {
    return (
      <div className="bg-black/60 text-white rounded-lg px-4 py-2 text-center text-sm">
        Data Unavailable
      </div>
    );
  }

  return (
    <div className="bg-black/60 text-white rounded-lg px-4 py-2 text-center">
      <div className="text-2xl font-mono">{Math.round(heading)}°</div>
      <div className="text-sm">{headingToCardinal(heading)}</div>
    </div>
  );
}
