"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export type StreamerTelemetryState = {
  lat: number | null;
  lon: number | null;
  heading: number | null;
  accuracy: number | null;
  updatedAt: number | null;
};

export type StreamerTelemetryStatus = "no-streamer" | "subscribed";

function rowToState(row: {
  lat?: number;
  lon?: number;
  heading?: number | null;
  accuracy?: number | null;
  updated_at?: string | null;
} | null): StreamerTelemetryState {
  if (!row) {
    return { lat: null, lon: null, heading: null, accuracy: null, updatedAt: null };
  }
  const lat = typeof row.lat === "number" ? row.lat : null;
  const lon = typeof row.lon === "number" ? row.lon : null;
  const heading = row.heading != null ? Number(row.heading) : null;
  const accuracy = row.accuracy != null ? Number(row.accuracy) : null;
  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
  return { lat, lon, heading, accuracy, updatedAt };
}

/**
 * Fetch initial streamer_telemetry row and subscribe to Realtime changes.
 * If streamerId is falsy, returns { telemetry: null, status: 'no-streamer' } and does not call Supabase.
 */
export function useStreamerTelemetry(streamerId: string | null): {
  telemetry: StreamerTelemetryState | null;
  status: StreamerTelemetryStatus;
} {
  const [telemetry, setTelemetry] = useState<StreamerTelemetryState | null>(null);
  const [status, setStatus] = useState<StreamerTelemetryStatus>("no-streamer");

  useEffect(() => {
    if (!streamerId) {
      setTelemetry(null);
      setStatus("no-streamer");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (isDev && typeof console !== "undefined" && console.debug) {
      console.debug("[telemetry] subscribed", streamerId);
    }

    const fetchInitial = async () => {
      const { data } = await supabase
        .from("streamer_telemetry")
        .select("lat, lon, heading, accuracy, updated_at")
        .eq("streamer_id", streamerId)
        .maybeSingle();
      setTelemetry(rowToState(data));
    };

    fetchInitial();
    setStatus("subscribed");

    const channel = supabase
      .channel(`streamer_telemetry:${streamerId}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "streamer_telemetry",
          filter: `streamer_id=eq.${streamerId}`,
          event: "*",
        },
        (payload) => {
          if (isDev && typeof console !== "undefined" && console.debug) {
            console.debug("[telemetry] update", payload.new);
          }
          const r = payload.new as Record<string, unknown> | null;
          if (r && typeof r === "object") {
            setTelemetry(
              rowToState({
                lat: r.lat as number,
                lon: r.lon as number,
                heading: r.heading as number | null,
                accuracy: r.accuracy as number | null,
                updated_at: r.updated_at as string | null,
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamerId]);

  return { telemetry, status };
}
