"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const THROTTLE_MS = 100; // ~10 Hz

function isIOSPermissionRequired(): boolean {
  if (typeof DeviceOrientationEvent === "undefined") return false;
  const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> }).requestPermission;
  return typeof req === "function";
}

function getCompassHeading(e: DeviceOrientationEvent): number | null {
  const w = window as unknown as { webkitCompassHeading?: number };
  if (typeof w.webkitCompassHeading === "number" && !Number.isNaN(w.webkitCompassHeading)) {
    return (w.webkitCompassHeading + 360) % 360;
  }
  if (e.absolute === true && typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha + 360) % 360;
  }
  if (typeof e.alpha === "number" && !Number.isNaN(e.alpha)) {
    return (360 - e.alpha + 360) % 360;
  }
  return null;
}

export type PermissionState = "unknown" | "granted" | "denied";

export function useDeviceHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>("unknown");
  const lastTs = useRef(0);

  const requestPermission = useCallback(async (): Promise<void> => {
    if (!isIOSPermissionRequired()) return;
    try {
      const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> })
        .requestPermission;
      if (typeof req !== "function") return;
      const result = await req();
      setPermissionState(result);
    } catch {
      setPermissionState("denied");
    }
  }, []);

  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined") {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[compass] unsupported on this device/browser");
      }
      setSupported(false);
      return;
    }

    const iosNeedsPermission = isIOSPermissionRequired();
    if (iosNeedsPermission && permissionState !== "granted") {
      setSupported(true);
      return;
    }

    const eventName =
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== "undefined"
        ? "deviceorientation"
        : typeof window !== "undefined" && "ondeviceorientationabsolute" in window
          ? "deviceorientationabsolute"
          : "deviceorientation";

    const handler = (e: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastTs.current < THROTTLE_MS) return;
      lastTs.current = now;
      const h = getCompassHeading(e);
      if (h != null) {
        setHeading(h);
        if (process.env.NODE_ENV !== "production" && typeof console !== "undefined" && console.debug) {
          console.debug("[compass] heading", Math.round(h));
        }
      }
    };

    window.addEventListener(eventName, handler as EventListener);

    setSupported(true);

    return () => {
      window.removeEventListener(eventName, handler as EventListener);
    };
  }, [permissionState]);

  const needsPermission = isIOSPermissionRequired() && permissionState !== "granted";
  return { heading, supported, permissionState, requestPermission, needsPermission };
}
