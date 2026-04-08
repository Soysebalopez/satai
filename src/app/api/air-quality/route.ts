import { NextResponse } from "next/server";
import { BAHIA_BLANCA } from "@/lib/constants";

/**
 * GET /api/air-quality
 *
 * Combines data from two sources:
 * 1. Open-Meteo Air Quality (CAMS/Sentinel-5P derived) — always available
 * 2. OpenAQ ground stations — when available near Bahía Blanca
 *
 * Returns a unified summary with the best available data.
 */

const OPENAQ_BASE = "https://api.openaq.org/v3";
const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

export async function GET() {
  try {
    // Fetch both sources in parallel
    const [atmosphereData, groundData] = await Promise.all([
      fetchAtmosphere(),
      fetchOpenAQ(),
    ]);

    // Atmosphere (CAMS) is the primary source — always available
    const summary = atmosphereData || {};

    return NextResponse.json({
      source: atmosphereData ? "cams-sentinel5p" : "synthetic",
      groundStations: groundData.stations,
      groundStationCount: groundData.stations.length,
      updated: new Date().toISOString(),
      summary,
    });
  } catch (error) {
    console.error("Air quality API error:", error);
    return NextResponse.json({
      source: "error",
      updated: new Date().toISOString(),
      summary: {},
      groundStations: [],
      groundStationCount: 0,
    });
  }
}

async function fetchAtmosphere(): Promise<Record<string, { value: number; unit: string }> | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(BAHIA_BLANCA.center.lat),
      longitude: String(BAHIA_BLANCA.center.lng),
      current: "nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,pm2_5,pm10",
      timezone: "America/Argentina/Buenos_Aires",
    });

    const res = await fetch(`${AIR_QUALITY_BASE}?${params}`, {
      next: { revalidate: 1800 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const c = data.current;

    return {
      NO2: { value: round(c.nitrogen_dioxide), unit: "ug/m3" },
      SO2: { value: round(c.sulphur_dioxide), unit: "ug/m3" },
      O3: { value: round(c.ozone), unit: "ug/m3" },
      CO: { value: round(c.carbon_monoxide), unit: "ug/m3" },
      PM25: { value: round(c.pm2_5), unit: "ug/m3" },
      PM10: { value: round(c.pm10), unit: "ug/m3" },
    };
  } catch {
    return null;
  }
}

async function fetchOpenAQ() {
  try {
    const res = await fetch(
      `${OPENAQ_BASE}/locations?coordinates=${BAHIA_BLANCA.center.lat},${BAHIA_BLANCA.center.lng}&radius=25000&limit=5`,
      { headers: { Accept: "application/json" }, next: { revalidate: 3600 } }
    );

    if (!res.ok) return { stations: [] };
    const data = await res.json();
    const locations = data.results || [];

    return {
      stations: locations.map((loc: { id: number; name: string; coordinates: { latitude: number; longitude: number } }) => ({
        id: loc.id,
        name: loc.name,
        coordinates: loc.coordinates,
      })),
    };
  } catch {
    return { stations: [] };
  }
}

function round(n: number): number {
  if (n == null || isNaN(n)) return 0;
  return Math.round(n * 10) / 10;
}
