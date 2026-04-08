import { NextResponse } from "next/server";
import { BAHIA_BLANCA } from "@/lib/constants";

/**
 * GET /api/wind
 *
 * Fetches current and forecast wind data from Open-Meteo for Bahía Blanca.
 * Returns wind speed, direction, gusts, temperature, and humidity.
 */

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
  hourly: {
    time: string[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
    temperature_2m: number[];
  };
}

export async function GET() {
  try {
    const params = new URLSearchParams({
      latitude: String(BAHIA_BLANCA.center.lat),
      longitude: String(BAHIA_BLANCA.center.lng),
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code",
      hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m",
      forecast_days: "1",
      timezone: "America/Argentina/Buenos_Aires",
    });

    const res = await fetch(`${OPEN_METEO_BASE}?${params}`, {
      next: { revalidate: 1800 }, // Cache 30 min
    });

    if (!res.ok) {
      throw new Error(`Open-Meteo responded ${res.status}`);
    }

    const data: OpenMeteoResponse = await res.json();

    // Convert wind direction degrees to cardinal
    const dirLabel = degreesToCardinal(data.current.wind_direction_10m);
    const dirLabelEs = cardinalToSpanish(dirLabel);

    return NextResponse.json({
      source: "open-meteo",
      updated: data.current.time,
      current: {
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        windDirectionLabel: dirLabel,
        windDirectionLabelEs: dirLabelEs,
        windGusts: data.current.wind_gusts_10m,
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        weatherCode: data.current.weather_code,
      },
      // Next 12 hours of hourly forecasts
      forecast: data.hourly.time.slice(0, 12).map((time, i) => ({
        time,
        windSpeed: data.hourly.wind_speed_10m[i],
        windDirection: data.hourly.wind_direction_10m[i],
        windDirectionLabel: degreesToCardinal(data.hourly.wind_direction_10m[i]),
        windGusts: data.hourly.wind_gusts_10m[i],
        temperature: data.hourly.temperature_2m[i],
      })),
      dispersion: estimateDispersion(
        data.current.wind_direction_10m,
        data.current.wind_speed_10m
      ),
    });
  } catch (error) {
    console.error("Wind API error:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener datos de viento" },
      { status: 502 }
    );
  }
}

function degreesToCardinal(deg: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[Math.round(deg / 22.5) % 16];
}

function cardinalToSpanish(cardinal: string): string {
  const map: Record<string, string> = {
    N: "Norte", NNE: "Nor-noreste", NE: "Noreste", ENE: "Este-noreste",
    E: "Este", ESE: "Este-sureste", SE: "Sureste", SSE: "Sur-sureste",
    S: "Sur", SSW: "Sur-suroeste", SW: "Suroeste", WSW: "Oeste-suroeste",
    W: "Oeste", WNW: "Oeste-noroeste", NW: "Noroeste", NNW: "Nor-noroeste",
  };
  return map[cardinal] || cardinal;
}

/**
 * Estimates which neighborhoods of Bahía Blanca are downwind
 * from the petrochemical hub in Ingeniero White (south of the city).
 */
function estimateDispersion(windDirDeg: number, windSpeed: number) {
  // The petrochemical hub is roughly south-southwest of downtown
  // Wind FROM the south pushes emissions north toward the city
  const affectedAreas: string[] = [];
  const intensity = windSpeed > 20 ? "alta" : windSpeed > 10 ? "media" : "baja";

  // Normalize to 0-360
  const dir = ((windDirDeg % 360) + 360) % 360;

  // Wind direction = FROM where the wind blows
  // If wind is from S/SSW (160-210°), emissions go north toward the city
  if (dir >= 160 && dir <= 230) {
    affectedAreas.push("Villa Mitre", "Barrio Noroeste", "Centro");
  } else if (dir >= 130 && dir < 160) {
    affectedAreas.push("Barrio Universitario", "Palihue");
  } else if (dir > 230 && dir <= 270) {
    affectedAreas.push("Barrio Napostá", "Villa Floresta");
  } else if (dir >= 270 && dir <= 340) {
    affectedAreas.push("Ingeniero White", "Grünbein");
  } else {
    // Wind from the north — emissions pushed out to sea/campo
    affectedAreas.push("Dispersión favorable hacia el sur");
  }

  return {
    windFrom: degreesToCardinal(dir),
    intensity,
    affectedAreas,
    description:
      affectedAreas.length === 1 && affectedAreas[0].startsWith("Dispersión")
        ? "El viento actual dispersa las emisiones lejos de la zona urbana."
        : `Con viento del ${cardinalToSpanish(degreesToCardinal(dir)).toLowerCase()}, las emisiones del polo pueden afectar: ${affectedAreas.join(", ")}.`,
  };
}
