import { NextRequest, NextResponse } from "next/server";
import { calculateDispersion, type DispersionInput } from "@/lib/dispersion";

/**
 * POST /api/simulate
 *
 * Runs a dispersion simulation given a source point, event type,
 * and optionally custom wind data. If no wind data is provided,
 * fetches current conditions from Open-Meteo.
 */

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    source,
    eventType = "fuga_gas",
    durationMinutes = 60,
    windDirection,
    windSpeed,
    windGusts,
  } = body;

  if (!source || !Array.isArray(source) || source.length !== 2) {
    return NextResponse.json({ error: "source [lng, lat] requerido" }, { status: 400 });
  }

  try {
    // Use provided wind data or fetch current conditions
    let wind = { direction: windDirection, speed: windSpeed, gusts: windGusts };

    if (wind.direction == null || wind.speed == null) {
      const origin = new URL(request.url).origin;
      const windRes = await fetch(`${origin}/api/wind`);
      const windData = await windRes.json();
      wind = {
        direction: windData.current?.windDirection ?? 180,
        speed: windData.current?.windSpeed ?? 10,
        gusts: windData.current?.windGusts ?? wind.speed * 1.5,
      };
    }

    const input: DispersionInput = {
      source: source as [number, number],
      windDirection: wind.direction,
      windSpeed: wind.speed,
      windGusts: wind.gusts ?? wind.speed * 1.3,
      eventType,
      durationMinutes,
    };

    const result = calculateDispersion(input);

    // Generate AI interpretation
    const interpretation = await getInterpretation(input, result);

    return NextResponse.json({
      input: {
        source,
        eventType,
        durationMinutes,
        wind: {
          direction: wind.direction,
          speed: wind.speed,
          gusts: wind.gusts,
        },
      },
      result,
      interpretation,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Simulate API error:", error);
    return NextResponse.json({ error: "No se pudo ejecutar la simulacion" }, { status: 502 });
  }
}

async function getInterpretation(
  input: DispersionInput,
  result: ReturnType<typeof calculateDispersion>
): Promise<string | null> {
  const affected = result.affectedZones.filter((z) => z.concentrationLevel !== "none");
  const prompt = [
    "Genera una alerta ciudadana de 2-3 oraciones para una simulacion de emergencia ambiental en Bahia Blanca.",
    "Tono: urgente pero informativo, no alarmista. Indica que es una SIMULACION, no un evento real.",
    "Sin markdown. En espanol.",
    "",
    `Evento: ${input.eventType.replace("_", " ")}`,
    `Viento: ${input.windSpeed} km/h`,
    `Duracion simulada: ${input.durationMinutes} minutos`,
    affected.length > 0
      ? `Zonas afectadas: ${affected.map((z) => `${z.name} en ~${z.etaMinutes} min`).join(", ")}`
      : "Sin zonas residenciales afectadas",
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
