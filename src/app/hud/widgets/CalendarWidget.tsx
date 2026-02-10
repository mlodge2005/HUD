"use client";

import { useState, useEffect } from "react";

type Event = { id: string; title: string; start: string; end: string };

export default function CalendarWidget() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch("/api/widgets/calendar")
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => {});
  }, []);

  return (
    <div className="bg-black/60 text-white rounded-lg p-3 text-sm">
      <div className="font-medium mb-2">Calendar</div>
      <ul className="space-y-1">
        {events.slice(0, 5).map((e) => (
          <li key={e.id} className="truncate">
            {e.title} — {new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </li>
        ))}
        {events.length === 0 && <li className="text-gray-400">No events</li>}
      </ul>
    </div>
  );
}
