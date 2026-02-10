import { getOptionalAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminUsers from "./AdminUsers";

export default async function AdminPage() {
  const user = await getOptionalAuth();
  if (!user || user.role !== "admin") redirect("/login");

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">User management</h1>
      <AdminUsers />
    </main>
  );
}
