"use client";

import { useState, useEffect } from "react";

export default function LocalInfoWidget() {
  const [time, setTime] = useState(new Date().toISOString());
  const [location, setLocation] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/telemetry/latest")
      .then((r) => r.json())
      .then((data) => {
        if (data.lat != null && data.lon != null) {
          setLat(data.lat);
          setLon(data.lon);
        }
      })
      .catch(() => {});
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
      <div className="font-mono">{new Date(time).toLocaleTimeString()}</div>
      {location && <div className="text-gray-300 truncate">{location}</div>}
      {temp && <div>{temp}</div>}
      {!location && !temp && <div className="text-gray-400">Data Unavailable</div>}
    </div>
  );
}
