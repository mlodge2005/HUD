import { redirect } from "next/navigation";
import { getOptionalAuth } from "@/lib/auth";
import HUDClient from "./HUDClient";
import HUDErrorBoundary from "./HUDErrorBoundary";

export default async function HUDPage() {
  const user = await getOptionalAuth();
  if (!user) redirect("/login?from=/hud");
  if (user.mustChangePassword) redirect("/change-password?from=/hud");

  return (
    <HUDErrorBoundary>
      <HUDClient user={user} />
    </HUDErrorBoundary>
  );
}
