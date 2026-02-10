"use client";

import { useState, useEffect } from "react";

type Event = {
  id: string;
  userId: string | null;
  username: string | null;
  eventType: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function AuthEventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/auth-events?limit=50")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setEvents(data.events || []);
          setNextCursor(data.nextCursor ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    fetch("/api/admin/auth-events?limit=50&cursor=" + encodeURIComponent(nextCursor))
      .then((r) => r.json())
      .then((data) => {
        setEvents((prev) => [...prev, ...(data.events || [])]);
        setNextCursor(data.nextCursor ?? null);
      })
      .finally(() => setLoading(false));
  }

  if (loading && events.length === 0) return <p className="text-gray-900">Loading…</p>;

  return (
    <div className="text-gray-900">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100 text-gray-900">
              <th className="border p-2 text-left">Time</th>
              <th className="border p-2 text-left">Event</th>
              <th className="border p-2 text-left">User</th>
              <th className="border p-2 text-left">IP</th>
              <th className="border p-2 text-left">User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border text-gray-900">
                <td className="border p-2 text-sm">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="border p-2">
                  <span
                    className={
                      e.eventType === "login_success"
                        ? "text-green-600"
                        : e.eventType === "login_failed"
                          ? "text-red-600"
                          : "text-gray-600"
                    }
                  >
                    {e.eventType}
                  </span>
                </td>
                <td className="border p-2">{e.username ?? "—"}</td>
                <td className="border p-2 text-sm">{e.ip ?? "—"}</td>
                <td className="border p-2 text-sm max-w-xs truncate">{e.userAgent ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-4 px-4 py-2 border border-gray-300 rounded bg-white text-gray-900 hover:bg-gray-100 disabled:opacity-50"
        >
          Load more
        </button>
      )}
    </div>
  );
}
