"use client";

import { useState, useEffect } from "react";
import { useMapsDiagnostics } from "./MapsDiagnosticsContext";

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

type ServerDiagnostics = {
  keySet: boolean;
  keyLength: number;
  reverseGeocode: { ok: true; data: unknown } | { ok: false; error: string };
} | null;

export function MapsDiagnosticsPanel() {
  const { state } = useMapsDiagnostics();
  const [collapsed, setCollapsed] = useState(true);
  const [server, setServer] = useState<ServerDiagnostics>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDev || !collapsed) return;
    setServer(null);
    setFetchError(null);
  }, [collapsed]);

  useEffect(() => {
    if (!isDev || collapsed) return;
    setFetchError(null);
    fetch("/api/diagnostics/maps", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.keySet !== undefined) {
          setServer({
            keySet: data.keySet,
            keyLength: data.keyLength ?? 0,
            reverseGeocode: data.reverseGeocode ?? { ok: false, error: "No response" },
          });
        } else {
          setServer(null);
          setFetchError(data.error ?? "Unknown error");
        }
      })
      .catch((err) => {
        setFetchError(err?.message ?? "Fetch failed");
        setServer(null);
      });
  }, [collapsed]);

  if (!isDev) return null;

  return (
    <div className="fixed top-20 right-4 z-50 w-72 bg-gray-900 text-white rounded-lg border border-gray-600 shadow-lg text-xs">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-2 text-left font-medium flex justify-between items-center"
      >
        Maps Diagnostics
        <span>{collapsed ? "▼" : "▲"}</span>
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-700 pt-2">
          <div>
            <span className="text-gray-400">Client env key set:</span>{" "}
            {state.keySet ? "yes" : "no"}
          </div>
          <div>
            <span className="text-gray-400">Client key length:</span>{" "}
            {state.keyLength > 0 ? state.keyLength : "—"}
          </div>
          <div>
            <span className="text-gray-400">window.google.maps loaded:</span>{" "}
            {state.googleMapsLoaded ? "yes" : "no"}
          </div>
          <div>
            <span className="text-gray-400">Last script error:</span>{" "}
            {state.scriptError ?? "—"}
          </div>
          <div>
            <span className="text-gray-400">gm_authFailure occurred:</span>{" "}
            {state.authFailureAt != null
              ? `yes at ${new Date(state.authFailureAt).toISOString()}`
              : "no"}
          </div>
          <div className="border-t border-gray-700 pt-2">
            <span className="text-gray-400">Server / reverse-geocode:</span>
            {fetchError && (
              <div className="text-red-400 mt-1">Error: {fetchError}</div>
            )}
            {server && !fetchError && (
              <div className="mt-1 space-y-0.5">
                <div>Server key set: {server.keySet ? "yes" : "no"}</div>
                <div>Server key length: {server.keyLength}</div>
                <div>
                  Reverse-geocode test:{" "}
                {server.reverseGeocode.ok
                  ? "ok"
                  : `failed: ${server.reverseGeocode.error}`}
                </div>
                {server.reverseGeocode.ok &&
                server.reverseGeocode.data != null &&
                typeof server.reverseGeocode.data === "object" ? (
                  <div className="text-gray-500 truncate">
                    {JSON.stringify(server.reverseGeocode.data)}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
