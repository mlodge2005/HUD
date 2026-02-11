"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMapsDiagnostics } from "./MapsDiagnosticsContext";

const MAPS_SCRIPT_BASE = "https://maps.googleapis.com/maps/api/js";
const CALLBACK_NAME = "__hudMapsLoaded";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

declare global {
  interface Window {
    [CALLBACK_NAME]?: () => void;
    gm_authFailure?: () => void;
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts?: unknown) => GoogleMapInstance;
        LatLng: new (lat: number, lng: number) => { lat: () => number; lng: () => number };
        Marker: new (opts?: unknown) => GoogleMarkerInstance;
        Circle: new (opts?: unknown) => GoogleCircleInstance;
        Point: new (x: number, y: number) => { x: number; y: number };
        SymbolPath: { FORWARD_CLOSED_ARROW: unknown };
        event: { clearInstanceListeners: (obj: unknown) => void };
      };
    };
  }
}

interface GoogleMapInstance {
  setCenter(c: { lat: () => number; lng: () => number }): void;
}
interface GoogleMarkerInstance {
  setMap(map: unknown): void;
  setPosition(p: unknown): void;
  setIcon(icon: unknown): void;
}
interface GoogleCircleInstance {
  setMap(map: unknown): void;
  setCenter(c: unknown): void;
  setRadius(r: number): void;
}

type MapWidgetProps = {
  lat?: number | null;
  lon?: number | null;
  centerLat?: number | null;
  centerLon?: number | null;
  /** Streamer heading in degrees (0–359) for marker rotation. */
  heading?: number | null;
  /** Accuracy in meters for optional circle. */
  accuracy?: number | null;
  stale?: boolean;
  googleMapsApiKey?: string;
};

export default function MapWidget({
  lat: latProp,
  lon: lonProp,
  centerLat,
  centerLon,
  heading = null,
  accuracy = null,
  stale,
  googleMapsApiKey: keyProp = "",
}: MapWidgetProps) {
  const { state: diag, setDiagnostics } = useMapsDiagnostics();
  const searchParams = useSearchParams();
  const scriptLoadedRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const circleRef = useRef<GoogleCircleInstance | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const lat = latProp ?? centerLat ?? null;
  const lon = lonProp ?? centerLon ?? null;

  // Rotation calibration:
  // We assume incoming heading uses: 0°=North, 90°=East, increasing clockwise.
  // If arrow is off by 90°: try rotOffset=90 or rotOffset=-90 (i.e. rotation = (heading + 90) % 360).
  // If mirrored: try rotInvert=1 and optionally rotOffset=90 (i.e. (360 - heading + 90) % 360).
  // In dev: /hud?rotOffset=-90 | /hud?rotOffset=90 | /hud?rotInvert=1
  const rotOffset = isDev ? (Number(searchParams.get("rotOffset")) || 0) : 0;
  const rotInvert = isDev && searchParams.get("rotInvert") === "1";

  function calibratedRotation(rawHeading: number | null): number {
    const raw = rawHeading ?? 0;
    const INVERT = rotInvert;
    const OFFSET = rotOffset;
    return ((INVERT ? (360 - raw) : raw) + OFFSET + 360) % 360;
  }

  const key = typeof keyProp === "string" ? keyProp : "";
  const keySet = key.length > 0;

  useEffect(() => {
    setDiagnostics({ keySet, keyLength: key.length });
  }, [keySet, key.length, setDiagnostics]);

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
      setScriptReady(true);
    };

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `${MAPS_SCRIPT_BASE}?key=${encodeURIComponent(key)}&callback=${CALLBACK_NAME}`;
    script.onload = () => {
      if (typeof window.google?.maps === "undefined") {
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

  // Create map, marker, and optional circle once when script is ready and we have position
  useEffect(() => {
    if (!scriptReady || !window.google?.maps || lat == null || lon == null || !mapContainerRef.current || mapRef.current) return;

    const g = window.google.maps;
    const center = new g.LatLng(lat, lon);

    const map = new g.Map(mapContainerRef.current, {
      center: { lat, lng: lon },
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "cooperative",
    });
      mapRef.current = map as GoogleMapInstance;

      const rot = calibratedRotation(heading ?? null);
      const icon = {
        path: g.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: "#ea4335",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        rotation: rot,
        anchor: new g.Point(0, 2),
      };
      const marker = new g.Marker({
        position: center,
        map: mapRef.current,
        icon,
      });
      markerRef.current = marker as GoogleMarkerInstance;

      const accM = accuracy != null && accuracy > 0 ? accuracy : 0;
      if (accM > 0) {
        const circle = new g.Circle({
          center: { lat, lng: lon },
          radius: accM,
          fillColor: "#4285f4",
          fillOpacity: 0.15,
          strokeColor: "#4285f4",
          strokeOpacity: 0.5,
          strokeWeight: 1,
          map: mapRef.current,
        });
        circleRef.current = circle as GoogleCircleInstance;
      }

    if (isDev) console.debug("[map] marker updated");

    return () => {
      if (markerRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(markerRef.current);
      }
      markerRef.current = null;
      circleRef.current = null;
      mapRef.current = null;
    };
  // Only create once when script + position ready; heading/accuracy updates in next effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, lat, lon]);

  // Update marker position and rotation when lat/lon/heading/accuracy change (map already exists)
  useEffect(() => {
    if (!window.google?.maps || lat == null || lon == null) return;
    const g = window.google.maps;
    const center = new g.LatLng(lat, lon);

    if (mapRef.current) {
      mapRef.current.setCenter(center);
      if (isDev) console.debug("[geo] streamer lat/lng updated");
    }

    if (markerRef.current) {
      markerRef.current.setPosition(center);
      const rot = calibratedRotation(heading);
      const newIcon = {
        path: g.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: "#ea4335",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
        rotation: rot,
        anchor: new g.Point(0, 2),
      };
      markerRef.current.setIcon(newIcon);
      if (isDev) console.debug("[map] marker updated");
    }

    const accM = accuracy != null && accuracy > 0 ? accuracy : 0;
    if (circleRef.current) {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(accM);
    } else if (accM > 0 && mapRef.current && window.google?.maps) {
      const circle = new window.google.maps.Circle({
        center: { lat, lng: lon },
        radius: accM,
        fillColor: "#4285f4",
        fillOpacity: 0.15,
        strokeColor: "#4285f4",
        strokeOpacity: 0.5,
        strokeWeight: 1,
        map: mapRef.current,
      });
      circleRef.current = circle as GoogleCircleInstance;
    }
    // calibratedRotation is stable given rotOffset/rotInvert which are in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, heading, accuracy, rotOffset, rotInvert]);

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

  return (
    <div className="relative bg-black/60 rounded-lg overflow-hidden h-full w-full">
      {stale && (
        <div className="absolute top-1 left-1 z-10 text-amber-400 text-xs bg-black/60 px-1 rounded">Stale</div>
      )}
      <div ref={mapContainerRef} className="w-full h-full min-h-[12rem]" />
    </div>
  );
}
