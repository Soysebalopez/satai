import { NextResponse } from "next/server";
import { translateToCitizen } from "@/lib/translate";

/**
 * GET /api/summary
 *
 * Fetches all environmental data, then uses Claude to generate
 * a citizen-friendly summary in Spanish.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    // Fetch all data sources in parallel
    const [airRes, windRes, firesRes] = await Promise.all([
      fetch(`${origin}/api/air-quality`).then((r) => r.json()),
      fetch(`${origin}/api/wind`).then((r) => r.json()),
      fetch(`${origin}/api/fires`).then((r) => r.json()),
    ]);

    const summary = await translateToCitizen({
      airQuality: airRes.summary || {},
      wind: {
        speed: windRes.current?.windSpeed ?? 0,
        directionEs: windRes.current?.windDirectionLabelEs ?? "desconocido",
        temperature: windRes.current?.temperature ?? 0,
        humidity: windRes.current?.humidity ?? 0,
      },
      dispersion: {
        description: windRes.dispersion?.description ?? "",
        affectedAreas: windRes.dispersion?.affectedAreas ?? [],
      },
      fires: {
        count: firesRes.count ?? 0,
        summary: firesRes.summary?.description ?? "",
      },
    });

    return NextResponse.json({
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Summary API error:", error);
    return NextResponse.json(
      { error: "No se pudo generar el resumen", summary: null },
      { status: 502 }
    );
  }
}
