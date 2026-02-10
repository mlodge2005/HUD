"use client";

import dynamic from "next/dynamic";
import type { AuthUser } from "./HUDClient";

// HUD is loaded client-only (ssr: false) to avoid hydration mismatch (React #418).
// dynamic with ssr:false must be used in a Client Component in Next 15.
const HUDClient = dynamic(() => import("./HUDClient"), { ssr: false });

type Props = { user: AuthUser };

export default function HUDClientLoader({ user }: Props) {
  return <HUDClient user={user} />;
}
