"use client";

import Ably from "ably";

/**
 * Ably Realtime client for browser only. Uses token auth via /api/realtime/auth.
 * authCallback with credentials so session cookie is sent (same-origin).
 * Import only in client components (e.g. ChatWidget, presence UI).
 */
export function createAblyClient(): Ably.Realtime {
  if (typeof window === "undefined") {
    throw new Error("createAblyClient must run in the browser");
  }
  return new Ably.Realtime({
    authCallback: (tokenParams, callback) => {
      fetch("/api/realtime/auth", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (data.keyName) callback(null, data);
          else callback(data.error || "Auth failed", null);
        })
        .catch((err) => callback(String(err?.message ?? err), null));
    },
  });
}

export type { Ably };
