/**
 * Server-side only. Do not import in client components.
 * Uses GOOGLE_MAPS_API_KEY.
 */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

function getMapsKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY ??
    null
  );
}

/** Returns key length (0 if not set). Never returns the key value. */
export function getMapsKeyInfo(): { set: boolean; length: number } {
  const key = getMapsKey();
  if (!key || typeof key !== "string") return { set: false, length: 0 };
  return { set: true, length: key.length };
}

export type ReverseGeocodeResult = {
  city: string | null;
  state: string | null;
  country: string | null;
  formattedAddress?: string;
};

export type ReverseGeocodeResponse =
  | { ok: true; data: ReverseGeocodeResult }
  | { ok: false; error: string };

export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResponse> {
  const key = getMapsKey();
  if (!key) {
    return { ok: false, error: "GOOGLE_MAPS_API_KEY not set" };
  }

  const url = `${GEOCODE_URL}?latlng=${lat},${lon}&key=${key}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Fetch failed: ${message}` };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }

  if (data?.status === "REQUEST_DENIED") {
    return { ok: false, error: data.error_message ?? "Request denied (key/billing/referrer)" };
  }
  if (data?.status === "ZERO_RESULTS" || !Array.isArray(data?.results) || data.results.length === 0) {
    return { ok: true, data: { city: null, state: null, country: null } };
  }

  const ac = data.results[0]?.address_components ?? [];
  let city: string | null = null;
  let state: string | null = null;
  let country: string | null = null;
  for (const c of ac) {
    const types = c.types ?? [];
    if (types.includes("locality")) city = c.long_name ?? null;
    if (types.includes("administrative_area_level_1")) state = c.short_name ?? c.long_name ?? null;
    if (types.includes("country")) country = c.long_name ?? null;
  }

  return {
    ok: true,
    data: {
      city,
      state,
      country,
      formattedAddress: data.results[0]?.formatted_address,
    },
  };
}
