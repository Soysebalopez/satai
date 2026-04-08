import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/history?days=30&pollutant=NO2
 *
 * Returns historical air quality data.
 * When Supabase is connected, reads from the snapshots table.
 * Until then, generates data from Open-Meteo Air Quality hourly history.
 */

const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

const POLLUTANT_MAP: Record<string, string> = {
  NO2: "nitrogen_dioxide",
  SO2: "sulphur_dioxide",
  O3: "ozone",
  CO: "carbon_monoxide",
  PM25: "pm2_5",
  PM10: "pm10",
};

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get("days") || "7"), 30);
  const pollutant = request.nextUrl.searchParams.get("pollutant") || "NO2";

  const openMeteoVar = POLLUTANT_MAP[pollutant];
  if (!openMeteoVar) {
    return NextResponse.json(
      { error: `Contaminante invalido. Opciones: ${Object.keys(POLLUTANT_MAP).join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Use Open-Meteo historical/forecast data (up to 7 days past + forecast)
    // For longer history, we'll need Supabase snapshots
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const params = new URLSearchParams({
      latitude: "-38.72",
      longitude: "-62.27",
      hourly: openMeteoVar,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      timezone: "America/Argentina/Buenos_Aires",
    });

    const res = await fetch(`${AIR_QUALITY_BASE}?${params}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);

    const data = await res.json();
    const times: string[] = data.hourly?.time || [];
    const values: (number | null)[] = data.hourly?.[openMeteoVar] || [];

    // Aggregate to daily averages
    const dailyMap = new Map<string, { sum: number; count: number }>();
    for (let i = 0; i < times.length; i++) {
      const day = times[i].split("T")[0];
      const val = values[i];
      if (val === null || val === undefined) continue;
      const existing = dailyMap.get(day) || { sum: 0, count: 0 };
      existing.sum += val;
      existing.count++;
      dailyMap.set(day, existing);
    }

    const history = Array.from(dailyMap.entries())
      .map(([date, { sum, count }]) => ({
        date,
        value: Math.round((sum / count) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      pollutant,
      unit: "ug/m3",
      days,
      source: "open-meteo-cams",
      history,
    });
  } catch (error) {
    console.error("History API error:", error);
    return NextResponse.json(
      { error: "No se pudo obtener el historial" },
      { status: 502 }
    );
  }
}
