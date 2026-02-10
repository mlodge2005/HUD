import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-gray-900">
      <h1 className="text-2xl font-bold mb-4">HUD WebApp</h1>
      <Link
        href="/login"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Login
      </Link>
    </main>
  );
}
