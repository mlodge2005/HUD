"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, LocalVideoTrack } from "livekit-client";
import { decodeRTMessage, encodeRTMessage, type RTMessage, type RTStreamStatus } from "@/lib/realtime";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV !== "production";

type StreamUiState = "idle" | "connecting" | "live" | "error";

type Props = {
  isStreamer: boolean;
  userId: string;
  displayName: string;
  /** When set, viewers only attach video from this participant (active streamer). */
  activeStreamerUserId: string | null;
  room: Room | null;
  onRoomReady: (room: Room) => void;
  onDataReceived: (msg: RTMessage) => void;
  onLiveKitConfig: (configured: boolean) => void;
};

export default function HUDVideo({
  isStreamer,
  userId,
  displayName,
  activeStreamerUserId,
  room,
  onRoomReady,
  onDataReceived,
  onLiveKitConfig,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [streamUiState, setStreamUiState] = useState<StreamUiState>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamerControls, setStreamerControls] = useState(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telemetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLiveRef = useRef(false);
  isLiveRef.current = streamUiState === "live";
  const stopLiveRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const activeStreamerUserIdRef = useRef(activeStreamerUserId);
  activeStreamerUserIdRef.current = activeStreamerUserId;

  const isLive = streamUiState === "live";

  function isTrackFromActiveStreamer(participant: { identity?: string; metadata?: string }): boolean {
    const want = activeStreamerUserIdRef.current;
    if (!want) return true;
    try {
      const meta = participant.metadata ? JSON.parse(participant.metadata) : {};
      return meta.userId === want || participant.identity === want;
    } catch {
      return participant.identity === want;
    }
  }

  function logDiagnostics(roomInstance: Room, label: string) {
    if (!isDev) return;
    const local = roomInstance.localParticipant;
    const videoPubs = Array.from(local.trackPublications.values()).filter((p) => p.track?.kind === Track.Kind.Video);
    const remotes = Array.from(roomInstance.remoteParticipants.values()).map((p) => ({
      identity: p.identity,
      videoSubscribed: Array.from(p.trackPublications.values()).some((pub) => pub.track?.kind === Track.Kind.Video && pub.isSubscribed),
    }));
    console.log("[HUDVideo]", label, {
      localIdentity: local.identity,
      localVideoTrackPublications: videoPubs.length,
      remoteParticipants: remotes,
    });
  }

  useEffect(() => {
    let cancelled = false;
    let roomInstance: Room | null = null;

    async function connect() {
      const res = await fetch("/api/livekit/token/viewer", { method: "POST" });
      const data = await res.json();
      if (res.status === 503 || !data.token) {
        onLiveKitConfig(false);
        return;
      }
      onLiveKitConfig(true);
      if (isDev) console.log("[HUDVideo] Connecting with viewer token");
      roomInstance = new Room();
      roomRef.current = roomInstance;

      roomInstance.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (cancelled || !videoRef.current) return;
        if (track.kind !== Track.Kind.Video) return;
        if (!isTrackFromActiveStreamer(participant)) return;
        track.attach(videoRef.current);
        videoRef.current.play().catch(() => {});
        if (isDev) console.log("[HUDVideo] Attached remote video track from", participant.identity);
      });
      roomInstance.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (videoRef.current && track.kind === Track.Kind.Video) videoRef.current.srcObject = null;
      });

      await roomInstance.connect(data.url, data.token);
      if (isDev) console.log("[HUDVideo] LiveKit connect success (viewer token), identity:", roomInstance.localParticipant.identity);
      // Removed: setMetadata causes SignalRequestError "does not have permission to update own metadata"
      // unless token has canUpdateOwnMetadata. We don't need metadata to publish camera.

      if (!cancelled) {
        setStreamerControls(isStreamer);
        onRoomReady(roomInstance);
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (roomInstance) {
        roomInstance.disconnect();
        roomRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect once on mount
  }, [userId, displayName, onLiveKitConfig]);

  useEffect(() => {
    setStreamerControls(isStreamer);
  }, [isStreamer]);

  useEffect(() => {
    if (!room) return;
    const handler = (payload: Uint8Array) => {
      const msg = decodeRTMessage(payload);
      if (!msg) return;
      onDataReceived(msg);
      if (msg.type === "stream:handoff" && msg.newStreamerUserId !== userId && isLiveRef.current) {
        stopLiveRef.current();
      }
    };
    room.on(RoomEvent.DataReceived, handler);
    return () => {
      room.off(RoomEvent.DataReceived, handler);
    };
  }, [room, userId, onDataReceived]);

  useEffect(() => {
    if (!isStreamer) return;
    const interval = setInterval(() => {
      fetch("/api/stream/heartbeat", { method: "POST" }).catch(() => {});
    }, 2000);
    heartbeatIntervalRef.current = interval;
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [isStreamer]);

  useEffect(() => {
    if (!isStreamer || !isLive) return;
    if (typeof window !== "undefined" && window.DeviceOrientationEvent) {
      const handler = (e: DeviceOrientationEvent) => {
        if (e.alpha != null) (window as unknown as { _lastHeading?: number })._lastHeading = e.alpha;
      };
      window.addEventListener("deviceorientation", handler);
      return () => window.removeEventListener("deviceorientation", handler);
    }
    return () => {};
  }, [isStreamer, isLive]);

  useEffect(() => {
    if (!isStreamer || !isLive) return;
    const interval = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const accuracyM = pos.coords.accuracy ?? undefined;
          fetch("/api/telemetry/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat,
              lon,
              headingDeg: (window as unknown as { _lastHeading?: number })._lastHeading,
              accuracyM,
            }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }, 1500);
    telemetryIntervalRef.current = interval;
    return () => {
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
    };
  }, [isStreamer, isLive]);

  const goLive = async () => {
    const r = roomRef.current;
    if (!r || streamUiState === "connecting") return;
    setStreamError(null);
    setStreamUiState("connecting");
    let newRoom: Room | null = null;
    let videoTrack: LocalVideoTrack | null = null;
    try {
      if (isDev) console.log("[HUDVideo] goLive: fetching streamer token (POST /api/livekit/token/streamer)");
      const res = await fetch("/api/livekit/token/streamer", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.token) {
        const msg = data.error || "Cannot get streamer token. Are you the active streamer?";
        setStreamError(msg);
        setStreamUiState("error");
        if (isDev) console.log("[HUDVideo] goLive: token failed", res.status, data);
        return;
      }
      if (isDev) console.log("[HUDVideo] STREAMER TOKEN fetched");
      await r.disconnect();
      newRoom = new Room();
      roomRef.current = newRoom;
      await newRoom.connect(data.url, data.token);
      // Removed: setMetadata causes permission errors; token does not grant canUpdateOwnMetadata.
      if (isDev) console.log("[HUDVideo] goLive: room connected", { roomName: newRoom.name, localIdentity: newRoom.localParticipant.identity });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0]);
      if (isDev) console.log("[HUDVideo] local video track created");
      await newRoom.localParticipant.publishTrack(videoTrack, { simulcast: false });
      if (isDev) console.log("[HUDVideo] publishTrack resolved");

      await new Promise((resolve) => setTimeout(resolve, 2000));
      const videoPubs = newRoom.localParticipant.videoTrackPublications;
      const videoPubsSize = videoPubs.size;
      const videoPubsList = Array.from(videoPubs.values()).map((p) => ({ source: p.source, muted: p.isMuted, sid: p.trackSid }));
      const remoteVids = Array.from(newRoom.remoteParticipants.values()).map((p) => ({ id: p.identity, vids: p.videoTrackPublications.size }));
      if (isDev) {
        console.log("[HUDVideo] 2s post-publish check", {
          localVideoTrackPublicationsSize: videoPubsSize,
          localVideoTrackPublications: videoPubsList,
          remoteParticipants: remoteVids,
        });
      }

      if (videoPubsSize === 0) {
        const msg = "Publish failed: no published video track. Likely token perms or reconnect failure.";
        setStreamError(msg);
        setStreamUiState("error");
        videoTrack?.stop();
        await newRoom.disconnect();
        roomRef.current = null;
        if (isDev) console.error("[HUDVideo] goLive: no published video track after 2s");
        return;
      }

      logDiagnostics(newRoom, "goLive after publish");

      await fetch("/api/stream/set-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLive: true }),
      });
      setStreamUiState("live");
      if (videoRef.current && videoTrack) {
        videoTrack.attach(videoRef.current);
        videoRef.current.play().catch(() => {});
      }
      onRoomReady(newRoom);
      const statusMsg: RTStreamStatus = {
        type: "stream:status",
        activeStreamerUserId: userId,
        isLive: true,
        liveStartedAt: new Date().toISOString(),
        ts: Date.now(),
      };
      newRoom.localParticipant.publishData(encodeRTMessage(statusMsg), { reliable: true }).catch(() => {});
      if (isDev) console.log("[HUDVideo] goLive: LIVE – set-live true, local preview attached");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Go Live failed";
      setStreamError(msg);
      setStreamUiState("error");
      videoTrack?.stop();
      if (newRoom) {
        try {
          await newRoom.disconnect();
        } catch {}
        roomRef.current = null;
      }
      if (isDev) console.error("[HUDVideo] goLive error:", err);
    }
  };

  const stopLive = async () => {
    const r = roomRef.current;
    if (!r) return;
    setStreamError(null);
    try {
      const statusMsg: RTStreamStatus = {
        type: "stream:status",
        activeStreamerUserId: userId,
        isLive: false,
        liveStartedAt: null,
        ts: Date.now(),
      };
      r.localParticipant.publishData(encodeRTMessage(statusMsg), { reliable: true }).catch(() => {});
      r.localParticipant.trackPublications.forEach((pub) => {
        pub.track?.stop();
      });
      await r.disconnect();
      roomRef.current = null;
      await fetch("/api/stream/set-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLive: false }),
      });
      setStreamUiState("idle");
      if (videoRef.current) videoRef.current.srcObject = null;
      if (isDev) console.log("[HUDVideo] stopLive: disconnected, fetching viewer token (POST /api/livekit/token/viewer)");
      const res = await fetch("/api/livekit/token/viewer", { method: "POST" });
      const data = await res.json();
      if (!data.token) return;
      const newRoom = new Room();
      roomRef.current = newRoom;
      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (!videoRef.current || track.kind !== Track.Kind.Video) return;
        if (!isTrackFromActiveStreamer(participant)) return;
        track.attach(videoRef.current);
        videoRef.current.play().catch(() => {});
      });
      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (videoRef.current && track.kind === Track.Kind.Video) videoRef.current.srcObject = null;
      });
      await newRoom.connect(data.url, data.token);
      // Removed: setMetadata causes permission errors; not required for viewer reconnection.
      onRoomReady(newRoom);
      if (isDev) console.log("[HUDVideo] stopLive: reconnected with viewer token");
    } catch (err) {
      setStreamUiState("idle");
      if (isDev) console.error("[HUDVideo] stopLive error:", err);
    }
  };
  stopLiveRef.current = stopLive;

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      {streamError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-600 text-white px-4 py-2 rounded text-sm max-w-md text-center">
          {streamError}
        </div>
      )}
      {streamerControls && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20">
          {streamUiState === "idle" && (
            <button
              type="button"
              onClick={goLive}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Go Live
            </button>
          )}
          {streamUiState === "connecting" && (
            <button type="button" disabled className="px-4 py-2 bg-gray-500 text-white rounded cursor-not-allowed">
              Starting…
            </button>
          )}
          {streamUiState === "live" && (
            <button
              type="button"
              onClick={stopLive}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              LIVE • Stop
            </button>
          )}
          {streamUiState === "error" && (
            <>
              <button
                type="button"
                onClick={goLive}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
