"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, LocalVideoTrack } from "livekit-client";
import { decodeRTMessage, encodeRTMessage, type RTMessage, type RTStreamStatus } from "@/lib/realtime";

type Props = {
  isStreamer: boolean;
  userId: string;
  displayName: string;
  room: Room | null;
  onRoomReady: (room: Room) => void;
  onDataReceived: (msg: RTMessage) => void;
  onLiveKitConfig: (configured: boolean) => void;
};

export default function HUDVideo({
  isStreamer,
  userId,
  displayName,
  room,
  onRoomReady,
  onDataReceived,
  onLiveKitConfig,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [streamerControls, setStreamerControls] = useState(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telemetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLiveRef = useRef(false);
  isLiveRef.current = isLive;
  const stopLiveRef = useRef<() => Promise<void>>(() => Promise.resolve());

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
      roomInstance = new Room();
      roomRef.current = roomInstance;

      roomInstance.on(RoomEvent.TrackSubscribed, (track) => {
        if (cancelled || !videoRef.current) return;
        if (track.kind === Track.Kind.Video) {
          track.attach(videoRef.current);
        }
      });
      roomInstance.on(RoomEvent.TrackUnsubscribed, () => {
        if (videoRef.current) videoRef.current.srcObject = null;
      });

      await roomInstance.connect(data.url, data.token);
      roomInstance.localParticipant.setMetadata(JSON.stringify({ userId, displayName }));

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
    if (!r) return;
    const res = await fetch("/api/livekit/token/streamer", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.token) {
      alert("Cannot get streamer token. Are you the active streamer?");
      return;
    }
    await r.disconnect();
    const newRoom = new Room();
    roomRef.current = newRoom;
    await newRoom.connect(data.url, data.token);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const videoTrack = new LocalVideoTrack(stream.getVideoTracks()[0]);
    await newRoom.localParticipant.publishTrack(videoTrack, { simulcast: false });
    await fetch("/api/stream/set-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLive: true }),
    });
    setIsLive(true);
    if (videoRef.current) videoTrack.attach(videoRef.current);
    onRoomReady(newRoom);
    const statusMsg: RTStreamStatus = {
      type: "stream:status",
      activeStreamerUserId: userId,
      isLive: true,
      liveStartedAt: new Date().toISOString(),
      ts: Date.now(),
    };
    newRoom.localParticipant.publishData(encodeRTMessage(statusMsg), { reliable: true }).catch(() => {});
  };

  const stopLive = async () => {
    const r = roomRef.current;
    if (!r) return;
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
    await fetch("/api/stream/set-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLive: false }),
    });
    setIsLive(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    const res = await fetch("/api/livekit/token/viewer", { method: "POST" });
    const data = await res.json();
    if (data.token && videoRef.current) {
      const newRoom = new Room();
      roomRef.current = newRoom;
      newRoom.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video) track.attach(videoRef.current!);
      });
      await newRoom.connect(data.url, data.token);
      onRoomReady(newRoom);
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
      {streamerControls && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {!isLive ? (
            <button
              type="button"
              onClick={goLive}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Go Live
            </button>
          ) : (
            <button
              type="button"
              onClick={stopLive}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
}
