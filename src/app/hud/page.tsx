import { redirect } from "next/navigation";
import { getOptionalAuth } from "@/lib/auth";
import HUDErrorBoundary from "./HUDErrorBoundary";
import HUDClientLoader from "./HUDClientLoader";

export default async function HUDPage() {
  const user = await getOptionalAuth();
  if (!user) redirect("/login?from=/hud");
  if (user.mustChangePassword) redirect("/change-password?from=/hud");

  return (
    <HUDErrorBoundary>
      <HUDClientLoader user={user} />
    </HUDErrorBoundary>
  );
}
