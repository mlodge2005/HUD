"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Room } from "livekit-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HUDVideo from "./HUDVideo";
import CompassWidget from "./widgets/CompassWidget";
import CalendarWidget from "./widgets/CalendarWidget";
import LocalInfoWidget from "./widgets/LocalInfoWidget";
import MapWidget from "./widgets/MapWidget";
import ChatWidget from "./widgets/ChatWidget";
import { MapsDiagnosticsProvider } from "./widgets/MapsDiagnosticsContext";
import { MapsDiagnosticsPanel } from "./widgets/MapsDiagnosticsPanel";
import { TelemetryDiagnosticsPanel } from "./widgets/TelemetryDiagnosticsPanel";
import {
  encodeRTMessage,
  type RTMessage,
  type RTStreamStatus,
  type RTStreamRequest,
  type RTStreamRequestResponse,
  type RTStreamHandoff,
} from "@/lib/realtime";
import { useStreamerTelemetry } from "./hooks/useStreamerTelemetry";
import { useDeviceHeading } from "./hooks/useDeviceHeading";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  mustChangePassword: boolean;
};

type StreamStatus = {
  activeStreamerUserId: string | null;
  isLive: boolean;
  startedAt: string | null;
};

const POLL_STATE_INTERVAL_MS = 5000;
const TELEMETRY_PUBLISH_INTERVAL_MS = 400;

export default function HUDClient({ user, googleMapsApiKey = "" }: { user: AuthUser; googleMapsApiKey?: string }) {
  const router = useRouter();
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    activeStreamerUserId: null,
    isLive: false,
    startedAt: null,
  });
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  roomRef.current = room;
  const [adoptLoading, setAdoptLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestModal, setRequestModal] = useState<{
    fromUserId: string;
    fromUsername: string;
    ts: number;
  } | null>(null);
  const [liveKitConfigured, setLiveKitConfigured] = useState<boolean | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [bannerNow, setBannerNow] = useState(0);
  const [lastPublishAt, setLastPublishAt] = useState<number | null>(null);
  const [lastPublishStatus, setLastPublishStatus] = useState<string | null>(null);
  const [lastPublishError, setLastPublishError] = useState<string | null>(null);
  const [lastLocalLat, setLastLocalLat] = useState<number | null>(null);
  const [lastLocalLon, setLastLocalLon] = useState<number | null>(null);

  const { telemetry: streamerTelemetry, status: telemetryStatus } = useStreamerTelemetry(
    streamStatus.activeStreamerUserId
  );
  const deviceHeading = useDeviceHeading();
  const telemetryReceivedAt = streamerTelemetry?.updatedAt ?? 0;
  const telemetryStale = telemetryReceivedAt > 0 && Date.now() - telemetryReceivedAt > 10000;

  const isStreamer = streamStatus.activeStreamerUserId === user.id;
  const streamStatusRef = useRef(streamStatus);
  streamStatusRef.current = streamStatus;

  const publishData = useCallback((msg: RTMessage) => {
    const r = roomRef.current;
    if (!r) return;
    const data = encodeRTMessage(msg);
    r.localParticipant.publishData(data, { reliable: true }).catch(() => {});
  }, []);

  useEffect(() => {
    function fetchState() {
      fetch("/api/stream/state")
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) {
            setStreamStatus({
              activeStreamerUserId: data.activeStreamerUserId ?? null,
              isLive: data.isLive ?? false,
              startedAt: data.liveStartedAt ?? null,
            });
          }
        })
        .catch(() => {});
    }
    fetchState();
    const interval = setInterval(fetchState, POLL_STATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Banner tick so "Xs ago" updates
  useEffect(() => {
    const t = setInterval(() => setBannerNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Streamer only: publish telemetry to Supabase (geo + device heading), throttle 250–500ms, never if lat/lon missing
  useEffect(() => {
    if (!isStreamer || !navigator.geolocation) return;
    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          if (lat == null || lon == null) return;
          setLastLocalLat(lat);
          setLastLocalLon(lon);
          const accuracy = pos.coords.accuracy ?? null;
          const heading = deviceHeading.heading ?? null;
          (async () => {
            try {
              const res = await fetch("/api/streamer-telemetry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ lat, lon, heading, accuracy }),
              });
              setLastPublishAt(Date.now());
              setLastPublishStatus(res.ok ? "ok" : `error ${res.status}`);
              if (!res.ok) {
                const text = await res.text();
                const err = text || `HTTP ${res.status}`;
                setLastPublishError(err);
                if (typeof console !== "undefined" && console.error) {
                  console.error("[telemetry] publish failed", res.status, text);
                }
              } else {
                setLastPublishError(null);
              }
            } catch (e) {
              setLastPublishAt(Date.now());
              setLastPublishStatus("error");
              const err = e instanceof Error ? e.message : String(e);
              setLastPublishError(err);
              if (typeof console !== "undefined" && console.error) {
                console.error("[telemetry] publish error", e);
              }
            }
          })();
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }, TELEMETRY_PUBLISH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isStreamer, deviceHeading.heading]);

  const onDataReceived = useCallback((msg: RTMessage) => {
    if (msg.type === "stream:status") {
      const m = msg as RTStreamStatus;
      setStreamStatus({
        activeStreamerUserId: m.activeStreamerUserId,
        isLive: m.isLive,
        startedAt: m.liveStartedAt,
      });
    } else if (msg.type === "stream:request") {
      const m = msg as RTStreamRequest;
      const current = streamStatusRef.current;
      const amStreamer = current.activeStreamerUserId === user.id;
      if (amStreamer) {
        setRequestModal({ fromUserId: m.fromUserId, fromUsername: m.fromUsername, ts: m.ts });
      }
    } else if (msg.type === "stream:handoff") {
      setRequestModal(null);
    } else if (msg.type === "stream:request:response") {
      setRequestModal(null);
    }
  }, [user.id]);

  const adoptStream = useCallback(async () => {
    setAdoptLoading(true);
    try {
      const res = await fetch("/api/stream/adopt", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStreamStatus((prev) => ({
        ...prev,
        activeStreamerUserId: user.id,
        isLive: false,
        startedAt: null,
      }));
      setCalendarRefreshKey((k) => k + 1);
      const statusMsg: RTStreamStatus = {
        type: "stream:status",
        activeStreamerUserId: user.id,
        isLive: false,
        liveStartedAt: null,
        ts: Date.now(),
      };
      publishData(statusMsg);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAdoptLoading(false);
    }
  }, [user.id, publishData]);

  const requestStream = useCallback(async () => {
    setRequestLoading(true);
    try {
      const res = await fetch("/api/stream/request", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const requestMsg: RTStreamRequest = {
        type: "stream:request",
        fromUserId: user.id,
        fromUsername: user.displayName,
        ts: Date.now(),
      };
      publishData(requestMsg);
      alert("Request sent. Waiting for streamer to respond.");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRequestLoading(false);
    }
  }, [user.id, user.displayName, publishData]);

  const respondToRequest = useCallback(
    async (accepted: boolean, toUserId: string) => {
      try {
        const res = await fetch("/api/stream/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted, toUserId }),
        });
        if (!res.ok) throw new Error("Failed");
        setRequestModal(null);
        const ts = Date.now();
        if (accepted) {
          publishData({
            type: "stream:handoff",
            newStreamerUserId: toUserId,
            ts,
          } as RTStreamHandoff);
          publishData({
            type: "stream:status",
            activeStreamerUserId: toUserId,
            isLive: false,
            liveStartedAt: null,
            ts,
          } as RTStreamStatus);
        }
        publishData({
          type: "stream:request:response",
          accepted,
          toUserId,
          ts,
        } as RTStreamRequestResponse);
      } catch {
        alert("Failed to respond");
      }
    },
    [publishData]
  );

  const releaseStream = useCallback(async () => {
    try {
      await fetch("/api/stream/release", { method: "POST" });
      publishData({
        type: "stream:status",
        activeStreamerUserId: null,
        isLive: false,
        liveStartedAt: null,
        ts: Date.now(),
      } as RTStreamStatus);
    } catch {
      alert("Failed to release");
    }
  }, [publishData]);

  return (
    <MapsDiagnosticsProvider>
      <div className="hud-root flex min-h-screen w-screen flex-col overflow-hidden bg-black">
        <div className="flex-1 relative overflow-hidden">
        <HUDVideo
        isStreamer={isStreamer}
        userId={user.id}
        displayName={user.displayName}
        activeStreamerUserId={streamStatus.activeStreamerUserId}
        room={room}
        onRoomReady={setRoom}
        onDataReceived={onDataReceived}
        onLiveKitConfig={(configured) => setLiveKitConfigured(configured)}
      />

      {!streamStatus.activeStreamerUserId && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
          <div className="text-center text-white p-6">
            <p className="text-xl mb-4">No Live Stream — Adopt Stream Identity</p>
            <button
              type="button"
              onClick={adoptStream}
              disabled={adoptLoading}
              className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {adoptLoading ? "Adopting…" : "Adopt Stream Identity"}
            </button>
          </div>
        </div>
      )}

      {liveKitConfigured === false && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-600 text-white px-4 py-2 rounded text-sm">
          Streaming not configured (set LIVEKIT_* env vars)
        </div>
      )}

      {streamStatus.activeStreamerUserId && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 text-sm">
          {telemetryStale ? (
            <span className="bg-red-900/90 text-white px-3 py-1 rounded">
              Streamer offline / telemetry stale
            </span>
          ) : (
            <>
              <span className="bg-black/70 text-white px-2 py-1 rounded">
                Streamer: {streamStatus.activeStreamerUserId.slice(0, 8)}…
              </span>
              {streamerTelemetry?.updatedAt != null && bannerNow > 0 && (
                <span className="text-white/90">
                  {Math.round((bannerNow - (streamerTelemetry?.updatedAt ?? 0)) / 1000)}s ago
                </span>
              )}
              {streamStatus.isLive && (
                <span className="bg-red-600 text-white px-2 py-1 rounded font-medium">LIVE</span>
              )}
            </>
          )}
        </div>
      )}

      <div className="absolute top-4 left-4 z-30 w-48">
        <CalendarWidget
          activeStreamerUserId={streamStatus.activeStreamerUserId}
          refreshKey={calendarRefreshKey}
        />
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <CompassWidget
          heading={
            streamerTelemetry?.heading ??
            (isStreamer ? deviceHeading.heading : null)
          }
        />
      </div>
      <div className="absolute top-4 right-4 z-20 w-48">
        <LocalInfoWidget
          lat={streamerTelemetry?.lat ?? (isStreamer ? lastLocalLat : null)}
          lon={streamerTelemetry?.lon ?? (isStreamer ? lastLocalLon : null)}
          stale={telemetryStale}
        />
      </div>
      <div className="absolute bottom-4 right-4 z-20 w-64 h-48">
        <MapWidget
          lat={streamerTelemetry?.lat ?? (isStreamer ? lastLocalLat : null)}
          lon={streamerTelemetry?.lon ?? (isStreamer ? lastLocalLon : null)}
          heading={streamerTelemetry?.heading ?? null}
          accuracy={streamerTelemetry?.accuracy ?? null}
          stale={telemetryStale}
          googleMapsApiKey={googleMapsApiKey}
        />
      </div>
      <MapsDiagnosticsPanel />
      <TelemetryDiagnosticsPanel
        activeStreamerUserId={streamStatus.activeStreamerUserId}
        isStreamer={isStreamer}
        telemetryStatus={telemetryStatus}
        lastPublishAt={lastPublishAt}
        lastPublishStatus={lastPublishStatus}
        lastPublishError={lastPublishError}
        lastTelemetryAt={streamerTelemetry?.updatedAt ?? null}
        telemetry={streamerTelemetry ?? null}
      />
      <div className="absolute bottom-4 left-4 z-20 w-80 max-h-[45vh] overflow-hidden flex flex-col rounded-xl bg-black/40 backdrop-blur border border-white/10">
        <ChatWidget user={user} />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 items-center">
        {streamStatus.activeStreamerUserId && !isStreamer && (
          <button
            type="button"
            onClick={requestStream}
            disabled={requestLoading}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {requestLoading ? "Requesting…" : "Request to Stream"}
          </button>
        )}
        {user.role === "admin" && (
          <Link href="/admin" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">
            Admin
          </Link>
        )}
        {isStreamer && (
          <button
            type="button"
            onClick={releaseStream}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Release streamer
          </button>
        )}
        <Link href="/settings" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">
          Settings
        </Link>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login?from=/hud");
            router.refresh();
          }}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
        >
          Log out
        </button>
      </div>

      {requestModal && isStreamer && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
          <div className="bg-white text-gray-900 rounded-lg p-6 max-w-sm w-full mx-4">
            <p className="font-medium mb-2">
              {requestModal.fromUsername} wants to become the streamer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => respondToRequest(false, requestModal.fromUserId)}
                className="flex-1 py-2 border border-gray-300 rounded bg-gray-50 text-gray-900 hover:bg-gray-100"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => respondToRequest(true, requestModal.fromUserId)}
                className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </MapsDiagnosticsProvider>
  );
}
