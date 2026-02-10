"use client";

import { useState, useEffect } from "react";

type CalendarState = {
  connected: boolean;
  calendarId: string;
};

type CalendarEvent = {
  id: string;
  summary: string;
  startIso: string;
  endIso: string;
  startDisplay: string;
  endDisplay: string;
  dateDisplay: string;
};

export default function SettingsPage() {
  const [state, setState] = useState<CalendarState | null>(null);
  const [calendarIdInput, setCalendarIdInput] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [testEvents, setTestEvents] = useState<CalendarEvent[] | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/calendar")
      .then((r) => r.json())
      .then((data) => {
        setState({
          connected: Boolean(data.connected),
          calendarId: data.calendarId ?? "primary",
        });
        setCalendarIdInput(data.calendarId ?? "primary");
      })
      .catch(() => setState({ connected: false, calendarId: "primary" }));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (params.get("connected") === "1") {
      setMessage({ type: "success", text: "Google Calendar connected." });
      setState((s) => (s ? { ...s, connected: true } : s));
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("error")) {
      const err = params.get("error");
      setMessage({
        type: "error",
        text:
          err === "no_code"
            ? "No authorization code."
            : err === "exchange"
              ? "Failed to exchange code."
              : "OAuth error.",
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  function handleSaveCalendarId(e: React.FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    setMessage(null);
    fetch("/api/settings/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId: calendarIdInput.trim() || "primary" }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d));
        setState((s) => (s ? { ...s, calendarId: calendarIdInput.trim() || "primary" } : s));
        setMessage({ type: "success", text: "Calendar ID saved." });
      })
      .catch(() => setMessage({ type: "error", text: "Failed to save." }))
      .finally(() => setSaveLoading(false));
  }

  function handleDisconnect() {
    setDisconnectLoading(true);
    setMessage(null);
    fetch("/api/settings/calendar/disconnect", { method: "POST" })
      .then((r) => {
        if (!r.ok) return Promise.reject(new Error("Failed"));
        setState((s) => (s ? { ...s, connected: false } : s));
        setMessage({ type: "success", text: "Google Calendar disconnected." });
      })
      .catch(() => setMessage({ type: "error", text: "Failed to disconnect." }))
      .finally(() => setDisconnectLoading(false));
  }

  function handleTestFetch() {
    setTestLoading(true);
    setTestEvents(null);
    fetch("/api/settings/calendar/test")
      .then((r) => r.json())
      .then((data) => setTestEvents(data.events ?? []))
      .catch(() => setTestEvents([]))
      .finally(() => setTestLoading(false));
  }

  if (state === null) {
    return (
      <main className="p-4 text-gray-900">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-4 text-gray-900">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      {message && (
        <p
          className={`mb-4 text-sm p-2 rounded ${
            message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Google Calendar</h2>
        <p className="text-sm text-gray-600 mb-3">
          Connect your calendar to show your events when you are the active streamer on the HUD.
        </p>
        <div className="space-y-4 max-w-lg">
          <div>
            <span className="text-sm font-medium text-gray-700">Status: </span>
            <span className={state.connected ? "text-green-600" : "text-amber-600"}>
              {state.connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Calendar ID (optional, default: primary)
            </label>
            <form onSubmit={handleSaveCalendarId} className="flex gap-2">
              <input
                type="text"
                value={calendarIdInput}
                onChange={(e) => setCalendarIdInput(e.target.value)}
                placeholder="primary"
                className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={saveLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saveLoading ? "Saving…" : "Save"}
              </button>
            </form>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/google/oauth/start"
              className="inline-block px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              Connect Google Calendar
            </a>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnectLoading || !state.connected}
              className="px-4 py-2 border border-gray-300 rounded bg-gray-50 text-gray-900 hover:bg-gray-100 disabled:opacity-50"
            >
              {disconnectLoading ? "Disconnecting…" : "Disconnect"}
            </button>
            <button
              type="button"
              onClick={handleTestFetch}
              disabled={testLoading}
              className="px-4 py-2 border border-gray-300 rounded bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            >
              {testLoading ? "Fetching…" : "Test Fetch"}
            </button>
          </div>
          {testEvents !== null && (
            <div className="border border-gray-200 rounded p-3 bg-white">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Test fetch ({testEvents.length} events)
              </div>
              <ul className="text-sm space-y-1">
                {testEvents.length === 0 ? (
                  <li className="text-gray-500">No upcoming events</li>
                ) : (
                  testEvents.map((e) => (
                    <li key={e.id} className="truncate">
                      {e.summary} — {e.dateDisplay}
                      {e.startDisplay === "All day" ? " • All day" : ` • ${e.startDisplay}–${e.endDisplay}`}
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
