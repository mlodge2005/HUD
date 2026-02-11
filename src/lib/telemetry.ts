"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type TelemetryPayload = {
  streamerId: string;
  lat: number;
  lon: number;
  heading: number | null;
  accuracy?: number | null;
  ts: number;
  isLive: boolean;
};

const BROADCAST_EVENT = "telemetry";
const MAX_PUBLISH_PER_SEC = 2;
const publishTimestamps: number[] = [];

function channelName(roomName: string): string {
  return `hud:telemetry:${roomName}`;
}

function canPublish(): boolean {
  const now = Date.now();
  const windowStart = now - 1000;
  const recent = publishTimestamps.filter((t) => t > windowStart);
  return recent.length < MAX_PUBLISH_PER_SEC;
}

function recordPublish(): void {
  const now = Date.now();
  publishTimestamps.push(now);
  const windowStart = now - 2000;
  while (publishTimestamps.length && publishTimestamps[0] < windowStart) {
    publishTimestamps.shift();
  }
}

const publisherChannels = new Map<string, { channel: RealtimeChannel; subscribed: boolean }>();

/**
 * Publish telemetry to the room. Only the active streamer device should call this.
 * Uses supabase broadcast; rate limited to 2/sec.
 * If streamer identity is lost, call cleanupPublisherChannel(roomName).
 */
export function publishTelemetry(roomName: string, payload: TelemetryPayload): void {
  if (!canPublish()) return;
  const supabase = getSupabaseBrowserClient();
  const name = channelName(roomName);
  let entry = publisherChannels.get(name);
  if (!entry) {
    const channel = supabase.channel(name, { config: { broadcast: { self: true } } });
    channel.subscribe((status) => {
      const e = publisherChannels.get(name);
      if (e && status === "SUBSCRIBED") e.subscribed = true;
    });
    entry = { channel, subscribed: false };
    publisherChannels.set(name, entry);
  }
  if (!entry.subscribed) return;
  try {
    entry.channel.send({
      type: "broadcast",
      event: BROADCAST_EVENT,
      payload: { ...payload, ts: payload.ts ?? Date.now() },
    });
    recordPublish();
  } catch {
    // no-op
  }
}

/**
 * Call when streamer identity is lost to remove the publisher channel.
 */
export function cleanupPublisherChannel(roomName: string): void {
  const name = channelName(roomName);
  const entry = publisherChannels.get(name);
  if (entry) {
    getSupabaseBrowserClient().removeChannel(entry.channel);
    publisherChannels.delete(name);
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
 * Subscribe to streamer telemetry for the room. Callback is invoked for each broadcast.
 * Returns { unsubscribe, send }. Use send() from the streamer device only (rate limited to 2/sec).
 * For viewers, only use the callback; for streamer, also use send() to publish.
 */
export function subscribeTelemetry(
  roomName: string,
  onPayload: (payload: TelemetryPayload) => void
): TelemetrySubscription {
  const supabase = getSupabaseBrowserClient();
  const name = channelName(roomName);
  const channel = supabase.channel(name, { config: { broadcast: { self: true } } });

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
