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
  const context = `CONTEXTO: Bahia Blanca es una ciudad costera del sur de Buenos Aires, Argentina.
Al sur esta el polo petroquimico de Ingeniero White y la bahia. Al norte y oeste, campos agricolas de la pampa humeda.
La ciudad tiene ~300.000 habitantes. El estuario de la bahia es zona de humedales.
Es otono (abril) en el hemisferio sur.

INSTRUCCION: Analiza la imagen satelital y responde en 2-3 oraciones CONCRETAS sobre lo que observas.
NO describas la leyenda de colores. NO expliques que significa cada color.
SI menciona zonas especificas (el puerto, la bahia, los campos al norte, el area urbana).
SI da informacion util para un vecino de la ciudad.
Responde directamente sin introduccion, en espanol.`;

  const prompts: Record<SatelliteLayer, string> = {
    trueColor:
      context + "\n\nEsta es una foto satelital real (Sentinel-2, color natural) de Bahia Blanca tomada recientemente. " +
      "Que se observa? Hay nubes? Como se ve la bahia y la zona costera? Se nota actividad agricola en los campos?",
    ndvi:
      context + "\n\nEste es un mapa de vegetacion (NDVI) de Bahia Blanca. Verde oscuro = vegetacion densa, verde claro = moderada, marron = suelo desnudo, azul = agua. " +
      "Donde hay mas vegetacion y donde menos? Como estan los campos agricolas comparado con la zona urbana? La bahia y humedales se distinguen?",
    moisture:
      context + "\n\nEste es un mapa de humedad del suelo (NDMI) de Bahia Blanca. Azul = humedo, amarillo = moderado, rojo = seco. " +
      "Que zonas estan mas secas y cuales mas humedas? Los campos necesitan lluvia? Como esta la zona de la bahia?",
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
  const month = new Date().toLocaleString("es-AR", { month: "long" });
  const templates: Record<SatelliteLayer, string> = {
    trueColor:
      `Imagen captada por Sentinel-2 en ${month}. Se distingue el area urbana de Bahia Blanca, ` +
      "el estuario y puerto de Ingeniero White al sur, y los campos agricolas de la pampa al norte y oeste. " +
      "La bahia y sus humedales son visibles en la zona costera.",
    ndvi:
      `Mapa de vegetacion de ${month}. Los campos agricolas al norte y oeste de la ciudad muestran ` +
      "la mayor actividad vegetal de la zona. El area urbana y el polo petroquimico de Ingeniero White " +
      "presentan escasa vegetacion. Los humedales del estuario se distinguen como zona intermedia.",
    moisture:
      `Mapa de humedad del suelo de ${month}. La zona del estuario y la bahia presentan los niveles ` +
      "mas altos de humedad. Los campos agricolas muestran condiciones variables segun el estado de los cultivos. " +
      "El area urbana y las rutas aparecen como las zonas mas secas.",
  };
  return templates[layer];
}
