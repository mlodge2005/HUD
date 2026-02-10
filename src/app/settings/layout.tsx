import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalAuth } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalAuth();
  if (!user) redirect("/login?from=/settings");
  if (user.mustChangePassword) redirect("/change-password?from=/settings");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="bg-white border-b px-4 py-2 flex gap-4 items-center">
        <Link href="/hud" className="text-gray-700 hover:text-gray-900">
          HUD
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className="text-gray-700 hover:text-gray-900">
            Admin
          </Link>
        )}
        <span className="ml-auto text-sm text-gray-600">{user.displayName}</span>
      </nav>
      {children}
    </div>
  );
}
