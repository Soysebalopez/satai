import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/agro/analyze
 *
 * Analyzes a field's NDVI status and generates a citizen-friendly interpretation.
 * Uses Ollama (local) or template fallback.
 */

interface AnalyzeRequest {
  fieldName: string;
  location: string;
  ndviCurrent: number | null;
  ndviPrev: number | null;
  ndviChange: number | null;
  precipitation7d: number | null;
  areaHa: number;
}

export async function POST(request: NextRequest) {
  const body: AnalyzeRequest = await request.json();

  const prompt = buildPrompt(body);
  const interpretation = await tryOllama(prompt) || buildTemplate(body);

  return NextResponse.json({
    interpretation,
    generatedAt: new Date().toISOString(),
  });
}

async function tryOllama(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3:4b",
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 200 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.response?.trim() || null;
  } catch {
    return null;
  }
}

function buildPrompt(data: AnalyzeRequest): string {
  const lines = [
    "Sos un asistente tecnico para un ingeniero agronomo en la pampa humeda de Argentina.",
    "Analiza el estado de este campo y da un resumen accionable en 2-3 oraciones.",
    "Se directo y tecnico pero claro. Menciona si conviene hacer una visita presencial.",
    "Sin markdown. En espanol.",
    "",
    `Campo: ${data.fieldName} (${data.location})`,
    `Superficie: ${data.areaHa.toFixed(0)} hectareas`,
    `NDVI actual: ${data.ndviCurrent !== null ? data.ndviCurrent.toFixed(3) : "sin datos"}`,
  ];

  if (data.ndviPrev !== null) {
    lines.push(`NDVI semana anterior: ${data.ndviPrev.toFixed(3)}`);
  }
  if (data.ndviChange !== null) {
    lines.push(`Cambio: ${data.ndviChange > 0 ? "+" : ""}${data.ndviChange.toFixed(1)}%`);
  }
  if (data.precipitation7d !== null) {
    lines.push(`Precipitaciones ultimos 7 dias: ${data.precipitation7d} mm`);
  }

  lines.push("", "Analisis del campo:");
  return lines.join("\n");
}

function buildTemplate(data: AnalyzeRequest): string {
  const { ndviCurrent, ndviChange, precipitation7d, fieldName } = data;

  if (ndviCurrent === null) {
    return `Sin datos satelitales recientes para ${fieldName}. Puede deberse a cobertura nubosa. Se reintentara con la proxima imagen disponible.`;
  }

  const parts: string[] = [];

  if (ndviChange !== null && ndviChange < -15) {
    parts.push(
      `${fieldName}: caida significativa de NDVI (${ndviChange.toFixed(1)}%).`
    );
    if (precipitation7d !== null && precipitation7d < 5) {
      parts.push("Sin precipitaciones recientes — patron consistente con estres hidrico. Inspeccion presencial recomendada.");
    } else if (precipitation7d !== null && precipitation7d > 20) {
      parts.push("Hubo lluvias recientes, la caida podria deberse a anegamiento o exceso hidrico.");
    } else {
      parts.push("Investigar causa — podria ser estres hidrico, plaga, o daño por helada.");
    }
  } else if (ndviChange !== null && ndviChange < -8) {
    parts.push(
      `${fieldName}: leve disminucion de NDVI (${ndviChange.toFixed(1)}%). Monitorear en la proxima imagen.`
    );
  } else if (ndviCurrent < 0.3) {
    parts.push(`${fieldName}: NDVI bajo (${ndviCurrent.toFixed(2)}). Vegetacion escasa o en etapa temprana de desarrollo.`);
  } else {
    parts.push(`${fieldName}: sin anomalias. NDVI estable en ${ndviCurrent.toFixed(2)}.`);
  }

  return parts.join(" ");
}
