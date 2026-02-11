import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getMapsKeyInfo, reverseGeocode } from "@/lib/google-maps";

const TEST_LAT = 38.9072;
const TEST_LON = -77.0369;

/**
 * GET /api/diagnostics/maps
 * Returns Maps API key status (set + length only) and a test reverse-geocode result.
 * Auth required. Do not expose the key value.
 */
export async function GET() {
  try {
    await requireAuth();
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    return NextResponse.json({ error: "Unauthorized" }, { status: err.statusCode ?? 401 });
  }

  const keyInfo = getMapsKeyInfo();
  const reverseGeocodeResult = await reverseGeocode(TEST_LAT, TEST_LON);

  return NextResponse.json({
    keySet: keyInfo.set,
    keyLength: keyInfo.length,
    reverseGeocode: reverseGeocodeResult.ok
      ? { ok: true, data: reverseGeocodeResult.data }
      : { ok: false, error: reverseGeocodeResult.error },
  });
}
