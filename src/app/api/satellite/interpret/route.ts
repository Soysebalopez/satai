import { NextRequest, NextResponse } from "next/server";
import { fetchSentinelImage, type SatelliteLayer } from "@/lib/sentinel-hub";

/**
 * GET /api/satellite/interpret?layer=trueColor|ndvi|moisture
 *
 * Fetches a Sentinel-2 image and interprets it using Ollama (local)
 * with multimodal capabilities, or falls back to a template analysis.
 *
 * Returns a citizen-friendly interpretation of what the satellite sees.
 */
export async function GET(request: NextRequest) {
  const layer = (request.nextUrl.searchParams.get("layer") || "trueColor") as SatelliteLayer;

  try {
    const imageBuffer = await fetchSentinelImage({
      layer,
      width: 512,
      height: 512,
      maxCloudCoverage: 30,
    });

    const base64Image = imageBuffer.toString("base64");

    // Try Ollama with multimodal model
    const interpretation = await tryOllamaVision(base64Image, layer);
    if (interpretation) {
      return NextResponse.json({
        layer,
        interpretation,
        source: "ollama-vision",
        generatedAt: new Date().toISOString(),
      });
    }

    // Fallback: template-based interpretation
    return NextResponse.json({
      layer,
      interpretation: getTemplateInterpretation(layer),
      source: "template",
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Satellite interpret error:", error);
    return NextResponse.json(
      { error: "No se pudo interpretar la imagen satelital" },
      { status: 502 }
    );
  }
}

async function tryOllamaVision(base64Image: string, layer: SatelliteLayer): Promise<string | null> {
  const prompts: Record<SatelliteLayer, string> = {
    trueColor:
      "Esta es una imagen satelital Sentinel-2 en color real de Bahia Blanca, Argentina. " +
      "Describe brevemente en 2-3 oraciones lo que se observa: areas urbanas, vegetacion, cuerpos de agua, " +
      "la bahia, y cualquier cambio notable. Usa lenguaje simple para ciudadanos, en espanol.",
    ndvi:
      "Esta es una imagen satelital NDVI (indice de vegetacion) de Bahia Blanca, Argentina. " +
      "Los colores verdes oscuros indican vegetacion densa, verdes claros vegetacion moderada, " +
      "marrones suelo desnudo, y azules agua. Describe en 2-3 oraciones el estado de la vegetacion. En espanol.",
    moisture:
      "Esta es una imagen satelital de humedad del suelo (NDMI) de Bahia Blanca, Argentina. " +
      "Azules indican alta humedad, amarillos moderada, rojos/naranjas sequedad. " +
      "Describe en 2-3 oraciones las condiciones de humedad. En espanol.",
  };

  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3:4b",
        prompt: prompts[layer],
        images: [base64Image],
        stream: false,
        options: { temperature: 0.3, num_predict: 200 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.response?.trim() || null;
  } catch {
    return null;
  }
}

function getTemplateInterpretation(layer: SatelliteLayer): string {
  const templates: Record<SatelliteLayer, string> = {
    trueColor:
      "Imagen satelital de Bahia Blanca captada por Sentinel-2. Se observa el area urbana, " +
      "la bahia hacia el sur, y las zonas rurales circundantes. " +
      "Las areas verdes indican vegetacion activa en la periferia de la ciudad.",
    ndvi:
      "El analisis de vegetacion muestra las zonas verdes activas alrededor de Bahia Blanca. " +
      "Las areas mas verdes corresponden a campos con cultivos o pasturas, " +
      "mientras que el centro urbano y las zonas industriales aparecen con escasa vegetacion.",
    moisture:
      "El mapa de humedad del suelo muestra las condiciones hidricas de la region. " +
      "Las zonas cercanas a la bahia y cursos de agua presentan mayor humedad, " +
      "mientras que las areas urbanas y caminos presentan condiciones secas.",
  };
  return templates[layer];
}
