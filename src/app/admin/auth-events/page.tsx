import AuthEventsList from "../AuthEventsList";

export default function AuthEventsPage() {
  return (
    <main className="p-4 text-gray-900">
      <h1 className="text-2xl font-bold mb-4">Login history</h1>
      <AuthEventsList />
    </main>
  );
}
