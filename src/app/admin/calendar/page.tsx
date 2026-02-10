import Link from "next/link";

export default function AdminCalendarPage() {
  return (
    <main className="p-4 text-gray-900">
      <h1 className="text-2xl font-bold mb-4">Calendar</h1>
      <p className="mb-4">
        Calendar is per-user. Connect your own Google Calendar in Settings.
      </p>
      <Link
        href="/settings"
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Open Settings
      </Link>
    </main>
  );
}
