import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalAuth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getOptionalAuth();
  if (!user) redirect("/login?from=/admin");
  if (user.mustChangePassword) redirect("/change-password?from=/admin");
  if (user.role !== "admin") redirect("/hud");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-4 py-2 flex gap-4 items-center">
        <Link href="/admin" className="font-medium">
          Users
        </Link>
        <Link href="/admin/auth-events" className="text-gray-600 hover:text-gray-900">
          Login history
        </Link>
        <Link href="/hud" className="text-gray-600 hover:text-gray-900">
          HUD
        </Link>
        <span className="ml-auto text-sm text-gray-500">{user.displayName}</span>
      </nav>
      {children}
    </div>
  );
}
