"use client";

import { useEffect, useRef } from "react";
import { useMapsDiagnostics } from "./MapsDiagnosticsContext";

const MAPS_SCRIPT_BASE = "https://maps.googleapis.com/maps/api/js";
const CALLBACK_NAME = "__hudMapsLoaded";

declare global {
  interface Window {
    [CALLBACK_NAME]?: () => void;
    gm_authFailure?: () => void;
  }
}

type MapWidgetProps = {
  /** Streamer telemetry lat (preferred). centerLat/centerLon kept for compatibility. */
  lat?: number | null;
  lon?: number | null;
  centerLat?: number | null;
  centerLon?: number | null;
  stale?: boolean;
  /** Passed from server (GOOGLE_MAPS_API_KEY) so only one env var is needed. */
  googleMapsApiKey?: string;
};

export default function MapWidget({
  lat: latProp,
  lon: lonProp,
  centerLat,
  centerLon,
  stale,
  googleMapsApiKey: keyProp = "",
}: MapWidgetProps) {
  const { state: diag, setDiagnostics } = useMapsDiagnostics();
  const scriptLoadedRef = useRef(false);
  const lat = latProp ?? centerLat ?? null;
  const lon = lonProp ?? centerLon ?? null;

  const key = typeof keyProp === "string" ? keyProp : "";
  const keySet = key.length > 0;
  const keyLength = key.length;

  useEffect(() => {
    setDiagnostics({ keySet, keyLength });
  }, [keySet, keyLength, setDiagnostics]);

  useEffect(() => {
    if (!keySet || scriptLoadedRef.current) return;

    window.gm_authFailure = () => {
      if (typeof console !== "undefined" && console.error) {
        console.error("[maps] gm_authFailure: API key rejected (billing/referrer/API not enabled)");
      }
      setDiagnostics({ authFailureAt: Date.now() });
    };

    window[CALLBACK_NAME] = () => {
      scriptLoadedRef.current = true;
      setDiagnostics({ googleMapsLoaded: true, scriptError: null });
    };

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `${MAPS_SCRIPT_BASE}?key=${encodeURIComponent(key)}&callback=${CALLBACK_NAME}`;
    script.onload = () => {
      if (typeof (window as unknown as { google?: { maps?: unknown } }).google?.maps === "undefined") {
        if (typeof console !== "undefined" && console.error) {
          console.error("[maps] Script loaded but window.google.maps not defined");
        }
        setDiagnostics({ scriptError: "window.google.maps not defined" });
      }
    };
    script.onerror = () => {
      if (typeof console !== "undefined" && console.error) {
        console.error("[maps] Maps script failed to load (network or CORS)");
      }
      setDiagnostics({ scriptError: "Script failed to load" });
    };
    document.head.appendChild(script);

    return () => {
      window.gm_authFailure = undefined;
      window[CALLBACK_NAME] = undefined;
    };
  }, [keySet, key, setDiagnostics]);

  const authFailed = diag.authFailureAt != null;
  const scriptError = diag.scriptError != null;
  const showErrorBanner = !keySet || authFailed || scriptError;

  const errorMessage = !keySet
    ? "Maps API key not set (GOOGLE_MAPS_API_KEY)."
    : authFailed
      ? "Maps API key rejected (auth failure)."
      : scriptError
        ? `Maps script error: ${diag.scriptError}`
        : null;

  if (showErrorBanner && errorMessage) {
    if (typeof console !== "undefined" && console.error) {
      console.error("[maps] Map unavailable:", errorMessage);
    }
    return (
      <div className="bg-red-900/90 text-white rounded-lg p-3 h-full flex flex-col gap-2 text-sm">
        <p className="font-medium">Map unavailable</p>
        <p className="text-red-200">{errorMessage}</p>
        <p className="text-xs text-red-300">
          Check Billing + Maps JavaScript API enabled + HTTP referrer restrictions for
          localhost/vercel.
        </p>
      </div>
    );
  }

  if (lat == null || lon == null) {
    return (
      <div className="bg-black/60 text-white rounded-lg p-3 h-full flex flex-col items-center justify-center text-sm gap-1">
        {stale && <span className="text-amber-400 text-xs">Stale</span>}
        <span>No location</span>
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(key)}&center=${lat},${lon}&zoom=15`;
  return (
    <div className="relative bg-black/60 rounded-lg overflow-hidden h-full w-full">
      {stale && (
        <div className="absolute top-1 left-1 z-10 text-amber-400 text-xs bg-black/60 px-1 rounded">Stale</div>
      )}
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
