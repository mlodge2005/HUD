import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

const cache = new Map<
  string,
  { tempF: number; cachedAt: number }
>();

function cacheKey(lat: number, lon: number): string {
  const a = Math.round(lat * 100) / 100;
  const b = Math.round(lon * 100) / 100;
  return `${a}_${b}`;
}

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lonParam = request.nextUrl.searchParams.get("lon");
  if (!latParam || !lonParam) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }
  const lat = parseFloat(latParam);
  const lon = parseFloat(lonParam);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: "Invalid lat or lon" }, { status: 400 });
  }

  const key = cacheKey(lat, lon);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ tempF: hit.tempF });
  }

  try {
    const url = new URL(OPEN_METEO);
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current", "temperature_2m");
    url.searchParams.set("temperature_unit", "fahrenheit");
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json({ error: "Weather provider error" }, { status: 502 });
    }
    const data = (await res.json()) as { current?: { temperature_2m?: number } };
    const tempC = data?.current?.temperature_2m;
    const tempF = typeof tempC === "number" ? tempC : null;
    if (tempF != null) {
      cache.set(key, { tempF, cachedAt: now });
      return NextResponse.json({ tempF });
    }
    return NextResponse.json({ error: "No temperature data" }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Weather request failed" }, { status: 502 });
  }
}
