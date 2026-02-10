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
import {
  encodeRTMessage,
  type RTMessage,
  type RTStreamStatus,
  type RTStreamRequest,
  type RTStreamRequestResponse,
  type RTStreamHandoff,
} from "@/lib/realtime";

type AuthUser = {
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

export default function HUDClient({ user }: { user: AuthUser }) {
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
      if (amStreamer || user.role === "admin") {
        setRequestModal({ fromUserId: m.fromUserId, fromUsername: m.fromUsername, ts: m.ts });
      }
    } else if (msg.type === "stream:handoff") {
      setRequestModal(null);
    } else if (msg.type === "stream:request:response") {
      setRequestModal(null);
    }
  }, [user.id, user.role]);

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
    <div className="fixed inset-0 bg-black overflow-hidden">
      <HUDVideo
        isStreamer={isStreamer}
        userId={user.id}
        displayName={user.displayName}
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

      <div className="absolute top-4 left-4 z-20 w-48">
        <CalendarWidget
          activeStreamerUserId={streamStatus.activeStreamerUserId}
          refreshKey={calendarRefreshKey}
        />
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <CompassWidget />
      </div>
      <div className="absolute top-4 right-4 z-20 w-48">
        <LocalInfoWidget />
      </div>
      <div className="absolute bottom-4 right-4 z-20 w-64 h-48">
        <MapWidget />
      </div>
      <div className="absolute bottom-4 left-4 z-20 w-80 max-h-64">
        <ChatWidget room={room} user={user} />
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
        {(isStreamer || user.role === "admin") && (
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

      {requestModal && (isStreamer || user.role === "admin") && (
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
  );
}
