import { NextResponse } from "next/server";

/**
 * GET /api/fires
 *
 * Fetches active fire data from NASA FIRMS (Fire Information for Resource Management System).
 * Uses the open CSV endpoint for VIIRS data covering southern Buenos Aires province.
 * No API key needed for basic access.
 */

// Bounding box: wider area around Bahía Blanca (100km radius approx)
const BBOX = {
  west: -63.0,
  south: -39.5,
  east: -61.5,
  north: -38.0,
};

// NASA FIRMS open data URL for VIIRS SNPP (last 24h)
const FIRMS_URL = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/OPEN_KEY/VIIRS_SNPP_NRT/${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}/1`;

interface FirePoint {
  latitude: number;
  longitude: number;
  brightness: number;
  confidence: string;
  acqDate: string;
  acqTime: string;
  frp: number; // Fire Radiative Power
}

export async function GET() {
  try {
    const res = await fetch(FIRMS_URL, {
      next: { revalidate: 3600 }, // Cache 1 hour
    });

    if (!res.ok) {
      // FIRMS can be rate-limited — return empty with note
      return NextResponse.json({
        source: "nasa-firms",
        updated: new Date().toISOString(),
        fires: [],
        count: 0,
        note: "NASA FIRMS no disponible en este momento",
      });
    }

    const csvText = await res.text();
    const fires = parseFirmsCSV(csvText);

    return NextResponse.json({
      source: "nasa-firms",
      updated: new Date().toISOString(),
      fires,
      count: fires.length,
      bbox: BBOX,
      summary: buildFireSummary(fires),
    });
  } catch (error) {
    console.error("Fires API error:", error);
    return NextResponse.json({
      source: "nasa-firms",
      updated: new Date().toISOString(),
      fires: [],
      count: 0,
      note: "Error al consultar NASA FIRMS",
    });
  }
}

function parseFirmsCSV(csv: string): FirePoint[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const latIdx = headers.indexOf("latitude");
  const lngIdx = headers.indexOf("longitude");
  const brightIdx = headers.indexOf("bright_ti4");
  const confIdx = headers.indexOf("confidence");
  const dateIdx = headers.indexOf("acq_date");
  const timeIdx = headers.indexOf("acq_time");
  const frpIdx = headers.indexOf("frp");

  if (latIdx === -1 || lngIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    return {
      latitude: parseFloat(cols[latIdx]),
      longitude: parseFloat(cols[lngIdx]),
      brightness: brightIdx >= 0 ? parseFloat(cols[brightIdx]) : 0,
      confidence: confIdx >= 0 ? cols[confIdx] : "unknown",
      acqDate: dateIdx >= 0 ? cols[dateIdx] : "",
      acqTime: timeIdx >= 0 ? cols[timeIdx] : "",
      frp: frpIdx >= 0 ? parseFloat(cols[frpIdx]) : 0,
    };
  }).filter((f) => !isNaN(f.latitude) && !isNaN(f.longitude));
}

function buildFireSummary(fires: FirePoint[]) {
  if (fires.length === 0) {
    return {
      level: "none" as const,
      description: "No se detectaron focos de calor en las ultimas 24 horas.",
    };
  }

  const highConfidence = fires.filter(
    (f) => f.confidence === "high" || f.confidence === "h"
  );
  const maxFRP = Math.max(...fires.map((f) => f.frp));

  if (highConfidence.length > 3 || maxFRP > 50) {
    return {
      level: "high" as const,
      description: `${fires.length} focos de calor detectados, ${highConfidence.length} de alta confianza. Atencion recomendada.`,
    };
  }

  return {
    level: "low" as const,
    description: `${fires.length} foco(s) de calor detectado(s) en la zona. Confianza variable.`,
  };
}
