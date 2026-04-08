import { NextRequest, NextResponse } from "next/server";
import { ZONES } from "@/lib/zones";
import { AQI_THRESHOLDS, getAirLevel, AIR_LEVEL_LABELS } from "@/lib/constants";

/**
 * GET /api/polo/report?days=7
 *
 * Generates an environmental compliance report for the petrochemical hub area.
 * Returns structured JSON that the frontend renders as a professional report.
 * Can also be used to generate PDF exports.
 */

const AQ_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get("days") || "7"), 30);

  try {
    // Fetch data for Ingeniero White (polo) and average residential
    const poloZone = ZONES.find((z) => z.id === "ingeniero-white")!;
    const residentialZones = ZONES.filter((z) => z.type === "residential");

    const [poloData, ...residentialData] = await Promise.all([
      fetchZoneHistory(poloZone.lat, poloZone.lng, days),
      ...residentialZones.map((z) => fetchZoneHistory(z.lat, z.lng, days)),
    ]);

    // Calculate daily averages for residential
    const residentialAvg = averageZoneData(residentialData);

    // Build exceedance analysis
    const exceedances = analyzeExceedances(poloData);

    // Build comparison table
    const comparisonTable = buildComparison(poloData, residentialAvg);

    // AI interpretation
    const interpretation = await getInterpretation(poloData, residentialAvg, exceedances);

    const now = new Date();

    return NextResponse.json({
      title: "Reporte de Monitoreo Ambiental — Polo Petroquimico Bahia Blanca",
      period: {
        from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        to: now.toISOString().split("T")[0],
        days,
      },
      generatedAt: now.toISOString(),
      source: "CAMS / Sentinel-5P (via Open-Meteo Air Quality API)",
      methodology: "Datos modelados de composicion atmosferica derivados de observaciones satelitales Sentinel-5P y reanálisis CAMS de Copernicus.",
      sections: {
        summary: {
          title: "Resumen ejecutivo",
          content: interpretation,
        },
        currentStatus: {
          title: "Estado actual",
          data: poloData.current,
          levels: Object.fromEntries(
            Object.entries(poloData.current).map(([key, val]) => {
              const thresholdKey = key as keyof typeof AQI_THRESHOLDS;
              if (AQI_THRESHOLDS[thresholdKey]) {
                const level = getAirLevel(thresholdKey, val);
                return [key, { value: val, level, label: AIR_LEVEL_LABELS[level] }];
              }
              return [key, { value: val, level: "unknown", label: "—" }];
            })
          ),
        },
        exceedances: {
          title: "Superaciones de umbrales OMS",
          data: exceedances,
          thresholds: AQI_THRESHOLDS,
        },
        comparison: {
          title: "Comparacion polo vs zonas residenciales",
          data: comparisonTable,
        },
        dailyHistory: {
          title: `Historial diario (${days} dias)`,
          polo: poloData.daily,
          residential: residentialAvg,
        },
      },
    });
  } catch (error) {
    console.error("Report API error:", error);
    return NextResponse.json({ error: "No se pudo generar el reporte" }, { status: 502 });
  }
}

interface ZoneHistory {
  current: Record<string, number>;
  daily: Array<{ date: string; values: Record<string, number> }>;
}

async function fetchZoneHistory(lat: number, lng: number, days: number): Promise<ZoneHistory> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,pm2_5,pm10",
    hourly: "nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,pm2_5,pm10",
    past_days: String(Math.min(days, 7)),
    forecast_days: "1",
    timezone: "America/Argentina/Buenos_Aires",
  });

  const res = await fetch(`${AQ_BASE}?${params}`, { next: { revalidate: 3600 } });
  if (!res.ok) return { current: {}, daily: [] };

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
    .map(([date, p]) => ({
      date,
      values: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, round(v.sum / v.count)])),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { current, daily };
}

function averageZoneData(zones: ZoneHistory[]): Array<{ date: string; values: Record<string, number> }> {
  const allDates = new Set<string>();
  for (const z of zones) for (const d of z.daily) allDates.add(d.date);

  return Array.from(allDates).sort().map((date) => {
    const dayValues: Record<string, { sum: number; count: number }> = {};
    for (const z of zones) {
      const day = z.daily.find((d) => d.date === date);
      if (!day) continue;
      for (const [key, val] of Object.entries(day.values)) {
        if (!dayValues[key]) dayValues[key] = { sum: 0, count: 0 };
        dayValues[key].sum += val;
        dayValues[key].count++;
      }
    }
    return {
      date,
      values: Object.fromEntries(Object.entries(dayValues).map(([k, v]) => [k, round(v.sum / v.count)])),
    };
  });
}

function analyzeExceedances(data: ZoneHistory) {
  const results: Array<{ pollutant: string; daysExceeded: number; maxValue: number; threshold: number }> = [];

  for (const [key, thresholds] of Object.entries(AQI_THRESHOLDS)) {
    let exceeded = 0;
    let maxVal = 0;
    for (const day of data.daily) {
      const val = day.values[key];
      if (val > thresholds.moderate) exceeded++;
      if (val > maxVal) maxVal = val;
    }
    if (exceeded > 0 || maxVal > thresholds.good) {
      results.push({
        pollutant: key,
        daysExceeded: exceeded,
        maxValue: maxVal,
        threshold: thresholds.moderate,
      });
    }
  }
  return results;
}

function buildComparison(polo: ZoneHistory, residentialDaily: Array<{ date: string; values: Record<string, number> }>) {
  const poloAvg: Record<string, number> = {};
  const resAvg: Record<string, number> = {};

  for (const day of polo.daily) {
    for (const [key, val] of Object.entries(day.values)) {
      if (!poloAvg[key]) poloAvg[key] = 0;
      poloAvg[key] += val;
    }
  }
  for (const key of Object.keys(poloAvg)) {
    poloAvg[key] = round(poloAvg[key] / polo.daily.length);
  }

  for (const day of residentialDaily) {
    for (const [key, val] of Object.entries(day.values)) {
      if (!resAvg[key]) resAvg[key] = 0;
      resAvg[key] += val;
    }
  }
  for (const key of Object.keys(resAvg)) {
    resAvg[key] = round(resAvg[key] / Math.max(residentialDaily.length, 1));
  }

  return Object.keys(poloAvg).map((key) => ({
    pollutant: key,
    polo: poloAvg[key],
    residential: resAvg[key] || 0,
    ratio: resAvg[key] ? round(poloAvg[key] / resAvg[key]) : null,
    unit: "ug/m3",
  }));
}

async function getInterpretation(
  polo: ZoneHistory,
  residentialDaily: Array<{ date: string; values: Record<string, number> }>,
  exceedances: Array<{ pollutant: string; daysExceeded: number }>
): Promise<string> {
  const prompt = [
    "Genera un resumen ejecutivo de 3-4 oraciones para un reporte de monitoreo ambiental del polo petroquimico de Bahia Blanca.",
    "Tono: tecnico pero accesible, neutral, basado en datos. Sin markdown.",
    "",
    `Datos actuales del polo: ${JSON.stringify(polo.current)}`,
    `Superaciones de umbrales OMS: ${exceedances.length > 0 ? exceedances.map((e) => `${e.pollutant}: ${e.daysExceeded} dias`).join(", ") : "ninguna"}`,
    `Periodo: ultimos ${polo.daily.length} dias`,
  ].join("\n");

  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3:4b", prompt, stream: false,
        options: { temperature: 0.3, num_predict: 200 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.response?.trim()) return data.response.trim();
    }
  } catch {}

  // Template fallback
  const hasExceedances = exceedances.length > 0;
  return hasExceedances
    ? `Durante el periodo analizado, se registraron superaciones de umbrales OMS en ${exceedances.map((e) => e.pollutant).join(", ")}. Se recomienda monitoreo continuo y evaluacion de medidas de mitigacion.`
    : "Los niveles de contaminantes en el polo petroquimico se mantuvieron dentro de los umbrales recomendados por la OMS durante el periodo analizado. No se detectaron anomalias significativas.";
}

function round(n: number): number {
  if (n == null || isNaN(n)) return 0;
  return Math.round(n * 10) / 10;
}
