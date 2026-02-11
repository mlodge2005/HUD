"use client";

import { createSupabaseClient } from "@/lib/supabase/client";

export type TelemetryPayload = {
  streamerId: string;
  lat: number;
  lon: number;
  heading: number | null;
  accuracy?: number | null;
  ts: number;
  isLive: boolean;
};

const CHANNEL_NAME = "hud:telemetry";
const BROADCAST_EVENT = "telemetry";
const MAX_PUBLISH_PER_SEC = 2;

const publishTimestamps: number[] = [];

function canPublish(): boolean {
  const now = Date.now();
  const windowStart = now - 1000;
  const recent = publishTimestamps.filter((t) => t > windowStart);
  if (recent.length >= MAX_PUBLISH_PER_SEC) return false;
  return true;
}

function recordPublish(): void {
  const now = Date.now();
  publishTimestamps.push(now);
  const windowStart = now - 2000;
  while (publishTimestamps.length && publishTimestamps[0] < windowStart) {
    publishTimestamps.shift();
  }
}

function parsePayload(p: unknown): TelemetryPayload | null {
  if (
    !p ||
    typeof p !== "object" ||
    !("streamerId" in p) ||
    !("lat" in p) ||
    !("lon" in p) ||
    !("ts" in p) ||
    !("isLive" in p)
  )
    return null;
  const t = p as TelemetryPayload;
  return {
    streamerId: t.streamerId,
    lat: Number(t.lat),
    lon: Number(t.lon),
    heading: t.heading != null ? Number(t.heading) : null,
    accuracy: t.accuracy != null ? Number(t.accuracy) : null,
    ts: Number(t.ts),
    isLive: Boolean(t.isLive),
  };
}

export type TelemetrySubscription = {
  unsubscribe: () => void;
  /** Rate-limited send; only the active streamer device should call this. */
  send: (payload: TelemetryPayload) => void;
};

/**
 * Subscribe to streamer telemetry. Callback is invoked for each broadcast.
 * Returns { unsubscribe, send }. Use send() from the streamer device only (rate limited to 2/sec).
 */
export function subscribeTelemetry(onPayload: (payload: TelemetryPayload) => void): TelemetrySubscription {
  const supabase = createSupabaseClient();
  const channel = supabase.channel(CHANNEL_NAME, {
    config: { broadcast: { self: true } },
  });

  channel
    .on("broadcast", { event: BROADCAST_EVENT }, ({ payload }) => {
      const parsed = parsePayload(payload);
      if (parsed) onPayload(parsed);
    })
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
    send: (payload: TelemetryPayload) => {
      if (!canPublish()) return;
      try {
        channel.send({
          type: "broadcast",
          event: BROADCAST_EVENT,
          payload: { ...payload, ts: payload.ts ?? Date.now() },
        });
        recordPublish();
  } catch {
    // no-op
  }
    },
  };
}
