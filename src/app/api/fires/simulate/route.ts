import { NextRequest, NextResponse } from "next/server";
import { calculateDispersion } from "@/lib/dispersion";

/**
 * GET /api/fires/simulate
 *
 * Automatically detects active fires from NASA FIRMS and runs a dispersion
 * simulation for each one using current wind conditions.
 *
 * Returns an array of fire events with their dispersion plumes and
 * affected zones — ready to display on the map or send as alerts.
 *
 * This is a SIMULATION based on satellite fire detection + wind data,
 * not confirmed ground truth.
 */

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  try {
    // Fetch fires and wind in parallel
    const [firesRes, windRes] = await Promise.all([
      fetch(`${origin}/api/fires`).then((r) => r.json()),
      fetch(`${origin}/api/wind`).then((r) => r.json()),
    ]);

    const fires = firesRes.fires || [];
    const wind = windRes.current || { windDirection: 180, windSpeed: 10, windGusts: 15 };

    if (fires.length === 0) {
      return NextResponse.json({
        status: "clear",
        message: "No se detectaron focos de calor activos en la zona.",
        fires: [],
        generatedAt: new Date().toISOString(),
      });
    }

    // Run dispersion simulation for each fire
    const simulations = fires.map((fire: { latitude: number; longitude: number; confidence: string; frp: number; brightness: number }) => {
      // Determine event intensity from FRP (Fire Radiative Power)
      const durationMinutes = fire.frp > 30 ? 120 : fire.frp > 10 ? 60 : 30;

      const dispersion = calculateDispersion({
        source: [fire.longitude, fire.latitude],
        windDirection: wind.windDirection,
        windSpeed: wind.windSpeed,
        windGusts: wind.windGusts || wind.windSpeed * 1.3,
        eventType: "incendio_industrial",
        durationMinutes,
      });

      const affected = dispersion.affectedZones.filter((z) => z.concentrationLevel !== "none");

      return {
        fire: {
          latitude: fire.latitude,
          longitude: fire.longitude,
          confidence: fire.confidence,
          frp: fire.frp,
          brightness: fire.brightness,
        },
        simulation: {
          durationMinutes,
          plumes: dispersion.plumes,
          windBearing: dispersion.windBearing,
          affectedZones: dispersion.affectedZones,
          summary: dispersion.summary,
        },
        alert: affected.length > 0
          ? {
              level: affected.some((z) => z.concentrationLevel === "high") ? "high" : "medium",
              message: `Foco de calor detectado. Simulacion indica que el humo podria alcanzar ${affected.map((z) => `${z.name} en ~${z.etaMinutes} min`).join(", ")}. Basado en viento actual (${wind.windSpeed} km/h). SIMULACION, no confirmado en terreno.`,
              zones: affected.map((z) => z.name),
            }
          : {
              level: "low",
              message: `Foco de calor detectado a ${dispersion.affectedZones[0]?.distanceKm ?? "?"} km de la zona urbana. Segun el viento actual, la dispersion no alcanza zonas residenciales.`,
              zones: [],
            },
      };
    });

    // Generate overall AI interpretation
    const interpretation = await getInterpretation(simulations, wind);

    return NextResponse.json({
      status: fires.length > 0 ? "active" : "clear",
      fireCount: fires.length,
      wind: {
        speed: wind.windSpeed,
        direction: wind.windDirection,
        directionLabel: wind.windDirectionLabelEs || windRes.current?.windDirectionLabel,
      },
      simulations,
      interpretation,
      disclaimer: "SIMULACION basada en deteccion satelital (NASA FIRMS) y modelo de dispersion gaussiano con datos de viento en tiempo real. No es una confirmacion de incendio en terreno.",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Fire simulate error:", error);
    return NextResponse.json({ error: "No se pudo generar la simulacion" }, { status: 502 });
  }
}

async function getInterpretation(
  simulations: Array<{ fire: { latitude: number; longitude: number; frp: number }; alert: { level: string; message: string; zones: string[] } }>,
  wind: { windSpeed: number; windDirection: number },
): Promise<string | null> {
  const affectedAll = simulations.flatMap((s) => s.alert.zones);
  const unique = [...new Set(affectedAll)];
  const highAlert = simulations.some((s) => s.alert.level === "high");

  const prompt = [
    "Genera un alerta ciudadana de 2-3 oraciones sobre focos de calor detectados cerca de Bahia Blanca.",
    "Aclara que es una SIMULACION basada en datos satelitales, no un evento confirmado en terreno.",
    "Tono: informativo, no alarmista. Sin markdown. En espanol.",
    "",
    `Focos detectados: ${simulations.length}`,
    `Viento: ${wind.windSpeed} km/h`,
    unique.length > 0 ? `Zonas que podrian recibir humo: ${unique.join(", ")}` : "Sin zonas residenciales afectadas",
    highAlert ? "Al menos un foco tiene alta intensidad" : "Intensidad moderada a baja",
  ].join("\n");

  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3:4b", prompt, stream: false,
        options: { temperature: 0.3, num_predict: 150 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.response?.trim()) return data.response.trim();
    }
  } catch {}

  return null;
}
