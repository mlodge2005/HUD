"use client";

import { useState } from "react";
import type { StreamerTelemetryState, StreamerTelemetryStatus } from "../hooks/useStreamerTelemetry";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

type Props = {
  activeStreamerUserId: string | null;
  isStreamer: boolean;
  telemetryStatus: StreamerTelemetryStatus;
  lastPublishAt: number | null;
  lastPublishStatus: string | null;
  lastPublishError: string | null;
  lastTelemetryAt: number | null;
  telemetry: StreamerTelemetryState | null;
};

export function TelemetryDiagnosticsPanel({
  activeStreamerUserId,
  isStreamer,
  telemetryStatus,
  lastPublishAt,
  lastPublishStatus,
  lastPublishError,
  lastTelemetryAt,
  telemetry,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);

  if (!isDev) return null;

  return (
    <div className="fixed top-20 right-4 z-50 w-80 max-h-[80vh] overflow-auto bg-gray-900 text-white rounded-lg border border-gray-600 shadow-lg text-xs">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-2 text-left font-medium flex justify-between items-center"
      >
        Telemetry Diagnostics
        <span>{collapsed ? "▼" : "▲"}</span>
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-700 pt-2">
          <div>
            <span className="text-gray-400">activeStreamerUserId:</span>{" "}
            {activeStreamerUserId ?? "—"}
          </div>
          <div>
            <span className="text-gray-400">isStreamer:</span>{" "}
            {isStreamer ? "yes" : "no"}
          </div>
          <div>
            <span className="text-gray-400">telemetryStatus:</span>{" "}
            {telemetryStatus}
          </div>
          <div>
            <span className="text-gray-400">lastPublishAt:</span>{" "}
            {lastPublishAt != null ? new Date(lastPublishAt).toISOString() : "—"}
          </div>
          <div>
            <span className="text-gray-400">lastPublishStatus:</span>{" "}
            {lastPublishStatus ?? "—"}
          </div>
          <div>
            <span className="text-gray-400">lastPublishError:</span>{" "}
            <span className={lastPublishError ? "text-red-400" : ""}>
              {lastPublishError ?? "—"}
            </span>
          </div>
          <div>
            <span className="text-gray-400">lastTelemetryAt:</span>{" "}
            {lastTelemetryAt != null ? new Date(lastTelemetryAt).toISOString() : "—"}
          </div>
          <div className="border-t border-gray-700 pt-2 mt-2">
            <span className="text-gray-400 font-medium">telemetry</span>
            {telemetry ? (
              <pre className="mt-1 p-2 bg-black/40 rounded text-[10px] overflow-x-auto">
                {JSON.stringify(
                  {
                    lat: telemetry.lat,
                    lon: telemetry.lon,
                    heading: telemetry.heading,
                    accuracy: telemetry.accuracy,
                    updatedAt: telemetry.updatedAt != null ? new Date(telemetry.updatedAt).toISOString() : null,
                  },
                  null,
                  2
                )}
              </pre>
            ) : (
              <div className="text-gray-500 mt-1">null</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
