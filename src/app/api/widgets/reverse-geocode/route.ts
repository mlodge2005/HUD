import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }
  // Stub: return mock data (real integration when key present)
  return NextResponse.json({
    city: "Chicago",
    state: "IL",
    country: "USA",
  });
}
