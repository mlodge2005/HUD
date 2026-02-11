import { redirect } from "next/navigation";
import { getOptionalAuth } from "@/lib/auth";
import HUDErrorBoundary from "./HUDErrorBoundary";
import HUDClientLoader from "./HUDClientLoader";

export default async function HUDPage() {
  const user = await getOptionalAuth();
  if (!user) redirect("/login?from=/hud");
  if (user.mustChangePassword) redirect("/change-password?from=/hud");

  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  return (
    <HUDErrorBoundary>
      <HUDClientLoader user={user} googleMapsApiKey={googleMapsApiKey} />
    </HUDErrorBoundary>
  );
}
