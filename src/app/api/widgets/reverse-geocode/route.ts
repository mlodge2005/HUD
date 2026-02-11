import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { reverseGeocode } from "@/lib/google-maps";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");
  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  const latN = Number(lat);
  const lonN = Number(lon);
  if (Number.isNaN(latN) || Number.isNaN(lonN)) {
    return NextResponse.json({ error: "lat and lon must be numbers" }, { status: 400 });
  }

  const result = await reverseGeocode(latN, lonN);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    city: result.data.city,
    state: result.data.state,
    country: result.data.country,
    formattedAddress: result.data.formattedAddress,
  });
}
