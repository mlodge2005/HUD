"use client";

import { useDeviceHeading } from "../hooks/useDeviceHeading";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export default function CompassWidget() {
  const { heading, supported, requestPermission, needsPermission } = useDeviceHeading();

  if (!supported && isDev) {
    console.debug("[compass] unsupported on this device/browser");
  }

  return (
    <div className="bg-black/60 text-white rounded-lg px-4 py-2 text-center">
      <div className="text-sm text-gray-300">Heading</div>
      {heading !== null ? (
        <div className="text-2xl font-mono">{Math.round(heading)}°</div>
      ) : (
        <div className="text-xl font-mono text-gray-400">N/A</div>
      )}
      {needsPermission && (
        <button
          type="button"
          onClick={() => requestPermission()}
          className="mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
        >
          Enable Compass
        </button>
      )}
    </div>
  );
}
