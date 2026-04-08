import { NextResponse } from "next/server";
import { BAHIA_BLANCA } from "@/lib/constants";

/**
 * GET /api/air-quality
 *
 * Fetches air quality data from OpenAQ v3 API for stations near Bahía Blanca.
 * Returns latest measurements for NO2, SO2, CO, O3, PM2.5.
 */

const OPENAQ_BASE = "https://api.openaq.org/v3";

interface OpenAQMeasurement {
  parameter: { name: string; units: string };
  value: number;
  date: { utc: string; local: string };
  coordinates: { latitude: number; longitude: number } | null;
}

interface OpenAQLocation {
  id: number;
  name: string;
  locality: string | null;
  coordinates: { latitude: number; longitude: number };
  parameters: Array<{ name: string; units: string }>;
}

export async function GET() {
  try {
    // 1. Find stations near Bahía Blanca
    const locationsRes = await fetch(
      `${OPENAQ_BASE}/locations?coordinates=${BAHIA_BLANCA.center.lat},${BAHIA_BLANCA.center.lng}&radius=25000&limit=10`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 }, // Cache 1 hour
      }
    );

    if (!locationsRes.ok) {
      // If OpenAQ is down or no stations, return synthetic data for the area
      return NextResponse.json({
        source: "synthetic",
        updated: new Date().toISOString(),
        note: "OpenAQ no disponible — datos de ejemplo",
        stations: [],
        summary: getSyntheticSummary(),
      });
    }

    const locationsData = await locationsRes.json();
    const locations: OpenAQLocation[] = locationsData.results || [];

    if (locations.length === 0) {
      return NextResponse.json({
        source: "synthetic",
        updated: new Date().toISOString(),
        note: "Sin estaciones cerca de Bahia Blanca — datos de ejemplo",
        stations: [],
        summary: getSyntheticSummary(),
      });
    }

    // 2. Fetch latest measurements for each station
    const stationsWithData = await Promise.all(
      locations.slice(0, 5).map(async (loc) => {
        try {
          const measRes = await fetch(
            `${OPENAQ_BASE}/locations/${loc.id}/latest`,
            {
              headers: { Accept: "application/json" },
              next: { revalidate: 1800 },
            }
          );
          const measData = measRes.ok ? await measRes.json() : { results: [] };
          const measurements: OpenAQMeasurement[] = measData.results || [];

          return {
            id: loc.id,
            name: loc.name,
            locality: loc.locality,
            coordinates: loc.coordinates,
            measurements: measurements.map((m) => ({
              parameter: m.parameter.name,
              value: m.value,
              unit: m.parameter.units,
              updatedAt: m.date.utc,
            })),
          };
        } catch {
          return {
            id: loc.id,
            name: loc.name,
            locality: loc.locality,
            coordinates: loc.coordinates,
            measurements: [],
          };
        }
      })
    );

    return NextResponse.json({
      source: "openaq",
      updated: new Date().toISOString(),
      stations: stationsWithData,
      summary: buildSummary(stationsWithData),
    });
  } catch (error) {
    console.error("Air quality API error:", error);
    return NextResponse.json({
      source: "synthetic",
      updated: new Date().toISOString(),
      note: "Error al consultar OpenAQ — datos de ejemplo",
      stations: [],
      summary: getSyntheticSummary(),
    });
  }
}

function getSyntheticSummary() {
  return {
    NO2: { value: 32.4, unit: "µg/m³" },
    SO2: { value: 8.7, unit: "µg/m³" },
    PM25: { value: 18.2, unit: "µg/m³" },
    O3: { value: 45.1, unit: "µg/m³" },
  };
}

function buildSummary(
  stations: Array<{
    measurements: Array<{ parameter: string; value: number; unit: string }>;
  }>
) {
  const all = stations.flatMap((s) => s.measurements);
  const byParam: Record<string, { total: number; count: number; unit: string }> = {};

  for (const m of all) {
    const key = m.parameter.toUpperCase().replace(".", "");
    if (!byParam[key]) byParam[key] = { total: 0, count: 0, unit: m.unit };
    byParam[key].total += m.value;
    byParam[key].count++;
  }

  const summary: Record<string, { value: number; unit: string }> = {};
  for (const [key, data] of Object.entries(byParam)) {
    summary[key] = {
      value: Math.round((data.total / data.count) * 10) / 10,
      unit: data.unit,
    };
  }
  return summary;
}
