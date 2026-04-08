import { NextRequest, NextResponse } from "next/server";
import { ZONES } from "@/lib/zones";

/**
 * GET /api/polo?zone=ingeniero-white&days=7
 *
 * Returns atmospheric data for a specific zone.
 * Fetches from Open-Meteo Air Quality with zone-specific coordinates.
 * When no zone is specified, returns data for all zones.
 */

const AQ_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";
const POLLUTANTS = "nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,pm2_5,pm10,european_aqi";

interface ZoneData {
  zone: string;
  name: string;
  type: string;
  current: Record<string, number>;
  europeanAQI: number;
}

export async function GET(request: NextRequest) {
  const zoneId = request.nextUrl.searchParams.get("zone");
  const days = Math.min(Number(request.nextUrl.searchParams.get("days") || "7"), 30);

  try {
    const zones = zoneId ? ZONES.filter((z) => z.id === zoneId) : ZONES;

    if (zones.length === 0) {
      return NextResponse.json({ error: "Zona no encontrada" }, { status: 404 });
    }

    const results = await Promise.all(
      zones.map((zone) => fetchZoneData(zone.lat, zone.lng, zone.id, zone.name, zone.type, days))
    );

    // Calculate polo vs city comparison
    const polo = results.find((r) => r.zone === "ingeniero-white");
    const residential = results.filter((r) => r.type === "residential");

    let comparison = null;
    if (polo && residential.length > 0) {
      const avgResidential: Record<string, number> = {};
      for (const key of Object.keys(polo.current)) {
        const avg = residential.reduce((sum, r) => sum + (r.current[key] || 0), 0) / residential.length;
        avgResidential[key] = Math.round(avg * 10) / 10;
      }

      const ratios: Record<string, number> = {};
      for (const key of Object.keys(polo.current)) {
        if (avgResidential[key] > 0) {
          ratios[key] = Math.round((polo.current[key] / avgResidential[key]) * 100) / 100;
        }
      }

      comparison = {
        poloValues: polo.current,
        residentialAverage: avgResidential,
        ratios,
        summary: buildComparisonSummary(ratios),
      };
    }

    return NextResponse.json({
      updated: new Date().toISOString(),
      zones: results,
      comparison,
    });
  } catch (error) {
    console.error("Polo API error:", error);
    return NextResponse.json({ error: "No se pudieron obtener datos" }, { status: 502 });
  }
}

async function fetchZoneData(
  lat: number, lng: number, zoneId: string, name: string, type: string, days: number
): Promise<ZoneData & { daily?: Array<{ date: string; values: Record<string, number> }> }> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: POLLUTANTS,
    hourly: POLLUTANTS,
    forecast_days: "1",
    past_days: String(Math.min(days, 7)),
    timezone: "America/Argentina/Buenos_Aires",
  });

  const res = await fetch(`${AQ_BASE}?${params}`, { next: { revalidate: 1800 } });
  if (!res.ok) {
    return { zone: zoneId, name, type, current: {}, europeanAQI: 0 };
  }

  const data = await res.json();
  const c = data.current || {};

  const current: Record<string, number> = {
    NO2: round(c.nitrogen_dioxide),
    SO2: round(c.sulphur_dioxide),
    O3: round(c.ozone),
    CO: round(c.carbon_monoxide),
    PM25: round(c.pm2_5),
    PM10: round(c.pm10),
  };

  // Build daily averages from hourly data
  const hourly = data.hourly || {};
  const times: string[] = hourly.time || [];
  const dailyMap = new Map<string, Record<string, { sum: number; count: number }>>();

  for (let i = 0; i < times.length; i++) {
    const day = times[i].split("T")[0];
    if (!dailyMap.has(day)) dailyMap.set(day, {});
    const dayData = dailyMap.get(day)!;

    for (const [key, apiKey] of [
      ["NO2", "nitrogen_dioxide"], ["SO2", "sulphur_dioxide"], ["O3", "ozone"],
      ["CO", "carbon_monoxide"], ["PM25", "pm2_5"], ["PM10", "pm10"],
    ] as const) {
      const val = hourly[apiKey]?.[i];
      if (val == null) continue;
      if (!dayData[key]) dayData[key] = { sum: 0, count: 0 };
      dayData[key].sum += val;
      dayData[key].count++;
    }
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, pollutants]) => ({
      date,
      values: Object.fromEntries(
        Object.entries(pollutants).map(([k, v]) => [k, round(v.sum / v.count)])
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    zone: zoneId,
    name,
    type,
    current,
    europeanAQI: c.european_aqi || 0,
    daily,
  };
}

function round(n: number): number {
  if (n == null || isNaN(n)) return 0;
  return Math.round(n * 10) / 10;
}

function buildComparisonSummary(ratios: Record<string, number>): string {
  const elevated = Object.entries(ratios)
    .filter(([, r]) => r > 1.3)
    .sort(([, a], [, b]) => b - a);

  if (elevated.length === 0) {
    return "Los niveles en el polo petroquimico estan dentro del rango normal comparados con las zonas residenciales.";
  }

  const parts = elevated
    .slice(0, 3)
    .map(([key, ratio]) => `${key} ${Math.round((ratio - 1) * 100)}% mas alto`);

  return `En el polo petroquimico: ${parts.join(", ")} comparado con el promedio de las zonas residenciales.`;
}
