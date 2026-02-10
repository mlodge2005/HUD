import { prisma } from "./db";

const STREAM_STATE_ID = 1;
const HEARTBEAT_TIMEOUT_MS = 10_000;

export type StreamStateDto = {
  activeStreamerUserId: string | null;
  isLive: boolean;
  liveStartedAt: Date | null;
  lastHeartbeatAt: Date | null;
  updatedAt: Date;
};

function rowToDto(row: {
  activeStreamerUserId: string | null;
  isLive: boolean;
  liveStartedAt: Date | null;
  lastHeartbeatAt: Date | null;
  updatedAt: Date;
}): StreamStateDto {
  return {
    activeStreamerUserId: row.activeStreamerUserId,
    isLive: row.isLive,
    liveStartedAt: row.liveStartedAt,
    lastHeartbeatAt: row.lastHeartbeatAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Lazy expiry: if active streamer's last heartbeat is older than 10s, clear streamer.
 * Call at the start of stream-related endpoints.
 */
export async function maybeExpireStreamer(): Promise<{
  expired: boolean;
  state: StreamStateDto | null;
}> {
  const row = await prisma.streamState.findUnique({
    where: { id: STREAM_STATE_ID },
  });
  if (!row?.lastHeartbeatAt || !row.activeStreamerUserId) {
    return { expired: false, state: row ? rowToDto(row) : null };
  }
  const elapsed = Date.now() - row.lastHeartbeatAt.getTime();
  if (elapsed < HEARTBEAT_TIMEOUT_MS) {
    return { expired: false, state: rowToDto(row) };
  }
  const updated = await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: {
      activeStreamerUserId: null,
      isLive: false,
      liveStartedAt: null,
      lastHeartbeatAt: null,
      pendingRequestFromUserId: null,
      pendingRequestAt: null,
    },
  });
  return { expired: true, state: rowToDto(updated) };
}

export async function getStreamState(): Promise<StreamStateDto | null> {
  const row = await prisma.streamState.findUnique({
    where: { id: STREAM_STATE_ID },
  });
  if (!row) return null;
  return rowToDto(row);
}

export async function adoptStreamer(userId: string): Promise<StreamStateDto> {
  const row = await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: {
      activeStreamerUserId: userId,
      isLive: false,
      liveStartedAt: null,
      lastHeartbeatAt: new Date(),
      pendingRequestFromUserId: null,
      pendingRequestAt: null,
    },
  });
  return rowToDto(row);
}

export async function releaseStreamer(): Promise<StreamStateDto> {
  const row = await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: {
      activeStreamerUserId: null,
      isLive: false,
      liveStartedAt: null,
      lastHeartbeatAt: null,
      pendingRequestFromUserId: null,
      pendingRequestAt: null,
    },
  });
  return rowToDto(row);
}

export async function handoffTo(newStreamerUserId: string): Promise<StreamStateDto> {
  const row = await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: {
      activeStreamerUserId: newStreamerUserId,
      isLive: false,
      liveStartedAt: null,
      lastHeartbeatAt: new Date(),
      pendingRequestFromUserId: null,
      pendingRequestAt: null,
    },
  });
  return rowToDto(row);
}

export async function setLive(live: boolean): Promise<StreamStateDto> {
  const row = await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: {
      isLive: live,
      ...(live && { liveStartedAt: new Date() }),
      lastHeartbeatAt: new Date(),
    },
  });
  return rowToDto(row);
}

export async function heartbeat(userId: string): Promise<{ ok: boolean }> {
  const state = await prisma.streamState.findUnique({
    where: { id: STREAM_STATE_ID },
  });
  if (!state || state.activeStreamerUserId !== userId) {
    return { ok: false };
  }
  await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: { lastHeartbeatAt: new Date() },
  });
  return { ok: true };
}

export type PendingRequest = {
  fromUserId: string;
  fromUsername: string;
  at: Date;
} | null;

export async function getPendingStreamRequest(): Promise<PendingRequest> {
  const row = await prisma.streamState.findUnique({
    where: { id: STREAM_STATE_ID },
    select: {
      pendingRequestFromUserId: true,
      pendingRequestAt: true,
    },
  });
  if (!row?.pendingRequestFromUserId || !row.pendingRequestAt) return null;
  const user = await prisma.user.findUnique({
    where: { id: row.pendingRequestFromUserId },
    select: { displayName: true },
  });
  return {
    fromUserId: row.pendingRequestFromUserId,
    fromUsername: user?.displayName ?? "Unknown",
    at: row.pendingRequestAt,
  };
}

const STREAM_REQUEST_COOLDOWN_MS = 30_000;

export async function setPendingStreamRequest(fromUserId: string): Promise<{ ok: boolean; error?: string }> {
  const row = await prisma.streamState.findUnique({
    where: { id: STREAM_STATE_ID },
  });
  if (!row?.activeStreamerUserId) return { ok: false, error: "No active streamer" };
  if (row.activeStreamerUserId === fromUserId) return { ok: false, error: "You are the streamer" };
  if (row.pendingRequestFromUserId) {
    if (row.pendingRequestFromUserId === fromUserId) {
      const elapsed = Date.now() - (row.pendingRequestAt?.getTime() ?? 0);
      if (elapsed < STREAM_REQUEST_COOLDOWN_MS)
        return { ok: false, error: "Please wait before requesting again" };
    } else {
      return { ok: false, error: "Another request is pending" };
    }
  }
  await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: {
      pendingRequestFromUserId: fromUserId,
      pendingRequestAt: new Date(),
    },
  });
  return { ok: true };
}

export async function clearPendingStreamRequest(): Promise<void> {
  await prisma.streamState.update({
    where: { id: STREAM_STATE_ID },
    data: {
      pendingRequestFromUserId: null,
      pendingRequestAt: null,
    },
  });
}
