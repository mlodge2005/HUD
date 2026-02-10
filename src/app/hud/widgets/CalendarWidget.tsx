"use client";

import { useState, useEffect, useCallback } from "react";

type CalendarEvent = {
  id: string;
  summary: string;
  startIso: string;
  endIso: string;
  startDisplay: string;
  endDisplay: string;
  dateDisplay: string;
};

type CalendarData = {
  events: CalendarEvent[];
  connected: boolean;
  reason: string | null;
  sourceUserId: string | null;
  sourceDisplayName: string | null;
};

const CALENDAR_POLL_MS = 15000;

function fetchCalendar(): Promise<CalendarData> {
  return fetch("/api/widgets/calendar")
    .then((r) => r.json())
    .then((d) => ({
      events: Array.isArray(d.events) ? d.events : [],
      connected: Boolean(d.connected),
      reason: d.reason ?? null,
      sourceUserId: d.sourceUserId ?? null,
      sourceDisplayName: d.sourceDisplayName ?? null,
    }))
    .catch(() => ({
      events: [],
      connected: false,
      reason: "error",
      sourceUserId: null,
      sourceDisplayName: null,
    }));
}

type Props = {
  /** When this changes (e.g. after adopt/handoff), widget refetches. */
  activeStreamerUserId?: string | null;
  /** Increment to force refetch (e.g. after adopt succeeds). */
  refreshKey?: number;
};

export default function CalendarWidget({ activeStreamerUserId, refreshKey = 0 }: Props) {
  const [data, setData] = useState<CalendarData | null>(null);

  const refresh = useCallback(() => {
    fetchCalendar().then(setData);
  }, []);

  useEffect(() => {
    refresh();
  }, [activeStreamerUserId, refreshKey, refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, CALENDAR_POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  if (data === null) {
    return (
      <div className="bg-black/60 text-white rounded-lg p-3 text-sm">
        <div className="font-medium mb-2">Calendar</div>
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const title =
    data.connected && data.sourceDisplayName
      ? `Calendar: ${data.sourceDisplayName}`
      : "Calendar";

  let body: React.ReactNode;
  if (data.reason === "no_streamer") {
    body = <div className="text-gray-400">No active streamer</div>;
  } else if (data.reason === "streamer_not_connected") {
    body = (
      <div className="text-gray-400">
        {data.sourceDisplayName
          ? `${data.sourceDisplayName} has not connected a calendar`
          : "Streamer calendar not connected"}
      </div>
    );
  } else if (data.reason === "error") {
    body = <div className="text-gray-400">Unable to load calendar</div>;
  } else if (data.events.length === 0) {
    body = <div className="text-gray-400">Data Unavailable</div>;
  } else {
    body = data.events.slice(0, 5).map((e) => {
      const timeLine =
        e.startDisplay === "All day"
          ? e.dateDisplay + " • All day"
          : `${e.dateDisplay} • ${e.startDisplay}–${e.endDisplay}`;
      return (
        <div key={e.id} className="space-y-0.5">
          <div className="truncate font-medium">{e.summary}</div>
          <div className="text-gray-300 text-xs truncate">{timeLine}</div>
        </div>
      );
    });
  }

  return (
    <div className="bg-black/60 text-white rounded-lg p-3 text-sm">
      <div className="font-medium mb-2">{title}</div>
      <div className="space-y-2">{body}</div>
    </div>
  );
}
