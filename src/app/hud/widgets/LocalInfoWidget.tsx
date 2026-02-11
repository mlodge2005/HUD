"use client";

import { useState, useEffect } from "react";

type Props = {
  lat: number | null;
  lon: number | null;
  stale?: boolean;
};

export default function LocalInfoWidget({ lat, lon, stale }: Props) {
  const [time, setTime] = useState(new Date().toISOString());
  const [location, setLocation] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (lat == null || lon == null) return;
    fetch("/api/widgets/reverse-geocode?lat=" + lat + "&lon=" + lon)
      .then((r) => r.json())
      .then((data) => {
        const parts = [data?.city, data?.state, data?.country].filter(Boolean);
        setLocation(parts.length ? parts.join(", ") : null);
      })
      .catch(() => {});
    fetch("/api/widgets/weather?lat=" + lat + "&lon=" + lon)
      .then((r) => r.json())
      .then((data) => setTemp(data.tempF != null ? data.tempF + " °F" : null))
      .catch(() => {});
  }, [lat, lon]);

  return (
    <div className="bg-black/60 text-white rounded-lg p-3 text-sm">
      {stale && <div className="text-xs text-amber-400 mb-0.5">Stale</div>}
      <div className="font-mono">{new Date(time).toLocaleTimeString()}</div>
      {location && <div className="text-gray-300 truncate">{location}</div>}
      {temp && <div>{temp}</div>}
      {lat == null && lon == null && <div className="text-gray-400">Data Unavailable</div>}
      {lat != null && lon != null && !location && !temp && <div className="text-gray-400">Loading…</div>}
    </div>
  );
}
