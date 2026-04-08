import { NextResponse } from "next/server";
import { BAHIA_BLANCA } from "@/lib/constants";

/**
 * GET /api/atmosphere
 *
 * Fetches atmospheric composition data from Open-Meteo Air Quality API.
 * Data is derived from CAMS (Copernicus Atmosphere Monitoring Service)
 * which uses Sentinel-5P and other satellite inputs.
 *
 * Returns current + 24h forecast for NO2, SO2, O3, CO, PM2.5, PM10.
 */

const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

interface OpenMeteoAQResponse {
  current: {
    time: string;
    nitrogen_dioxide: number;
    sulphur_dioxide: number;
    ozone: number;
    carbon_monoxide: number;
    pm2_5: number;
    pm10: number;
    european_aqi: number;
  };
  hourly: {
    time: string[];
    nitrogen_dioxide: number[];
    sulphur_dioxide: number[];
    ozone: number[];
    carbon_monoxide: number[];
    pm2_5: number[];
    pm10: number[];
    european_aqi: number[];
  };
}

export async function GET() {
  try {
    const params = new URLSearchParams({
      latitude: String(BAHIA_BLANCA.center.lat),
      longitude: String(BAHIA_BLANCA.center.lng),
      current: "nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,pm2_5,pm10,european_aqi",
      hourly: "nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide,pm2_5,pm10,european_aqi",
      forecast_days: "1",
      timezone: "America/Argentina/Buenos_Aires",
    });

    const res = await fetch(`${AIR_QUALITY_BASE}?${params}`, {
      next: { revalidate: 1800 }, // Cache 30 min
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo Air Quality responded ${res.status}`);
    }

    const data: OpenMeteoAQResponse = await res.json();

    return NextResponse.json({
      source: "open-meteo-cams",
      dataOrigin: "CAMS / Sentinel-5P derived",
      updated: data.current.time,
      current: {
        NO2: { value: round(data.current.nitrogen_dioxide), unit: "ug/m3" },
        SO2: { value: round(data.current.sulphur_dioxide), unit: "ug/m3" },
        O3: { value: round(data.current.ozone), unit: "ug/m3" },
        CO: { value: round(data.current.carbon_monoxide), unit: "ug/m3" },
        PM25: { value: round(data.current.pm2_5), unit: "ug/m3" },
        PM10: { value: round(data.current.pm10), unit: "ug/m3" },
        europeanAQI: data.current.european_aqi,
      },
      forecast: data.hourly.time.slice(0, 24).map((time, i) => ({
        time,
        NO2: round(data.hourly.nitrogen_dioxide[i]),
        SO2: round(data.hourly.sulphur_dioxide[i]),
        O3: round(data.hourly.ozone[i]),
        CO: round(data.hourly.carbon_monoxide[i]),
        PM25: round(data.hourly.pm2_5[i]),
        PM10: round(data.hourly.pm10[i]),
        europeanAQI: data.hourly.european_aqi[i],
      })),
    });
  } catch (error) {
    console.error("Atmosphere API error:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener datos atmosfericos" },
      { status: 502 }
    );
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
