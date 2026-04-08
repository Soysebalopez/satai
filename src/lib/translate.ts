interface TranslationInput {
  airQuality: Record<string, { value: number; unit: string }>;
  wind: {
    speed: number;
    directionEs: string;
    temperature: number;
    humidity: number;
  };
  dispersion: {
    description: string;
    affectedAreas: string[];
  };
  fires: {
    count: number;
    summary: string;
  };
}

/**
 * Translates raw environmental data into a citizen-friendly summary.
 *
 * Strategy:
 * - Dev/local: Ollama (gemma3:4b) on localhost:11434
 * - Production: Gemini API (when key has quota) or template fallback
 * - Future: Supabase-cached summaries regenerated via cron
 */
export async function translateToCitizen(input: TranslationInput): Promise<string> {
  const prompt = buildPrompt(input);

  // Try Ollama first (works in dev)
  const ollamaResult = await tryOllama(prompt);
  if (ollamaResult) return ollamaResult;

  // Try Gemini if key is configured
  if (process.env.GEMINI_API_KEY) {
    const geminiResult = await tryGemini(prompt);
    if (geminiResult) return geminiResult;
  }

  // Template fallback — always works, no AI needed
  return buildTemplateSummary(input);
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
        options: { temperature: 0.3, num_predict: 150 },
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

async function tryGemini(prompt: string): Promise<string | null> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { maxOutputTokens: 200, temperature: 0.3 },
    });
    return response.text?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Template-based summary — no AI needed, works everywhere.
 * Used as production fallback until Supabase cron is set up.
 */
function buildTemplateSummary(input: TranslationInput): string {
  const parts: string[] = [];

  // Air quality assessment
  const no2 = input.airQuality.NO2?.value ?? 0;
  const pm25 = input.airQuality.PM25?.value ?? 0;
  let airLevel = "buena";
  if (no2 > 50 || pm25 > 25) airLevel = "moderada";
  if (no2 > 100 || pm25 > 50) airLevel = "mala";

  parts.push(
    `La calidad del aire en Bahia Blanca es ${airLevel.toUpperCase()}.`
  );

  // Wind + temperature
  if (input.wind.speed > 0) {
    parts.push(
      `Temperatura de ${input.wind.temperature} grados con viento del ${input.wind.directionEs.toLowerCase()} a ${input.wind.speed} km/h.`
    );
  }

  // Dispersion
  if (input.dispersion.affectedAreas.length > 0 && !input.dispersion.affectedAreas[0].startsWith("Dispersion")) {
    parts.push(input.dispersion.description);
  }

  // Fires
  if (input.fires.count > 0) {
    parts.push(input.fires.summary);
  }

  return parts.join(" ");
}

function buildPrompt(input: TranslationInput): string {
  const lines: string[] = [
    "Sos un traductor de datos ambientales para ciudadanos de Bahia Blanca, Argentina.",
    "Traduci estos datos a un resumen de 2-3 oraciones en lenguaje simple, sin jerga cientifica.",
    "Usa el semaforo: BUENO, MODERADO, MALO o PELIGROSO. Se neutral, no acusatorio. Sin markdown.",
    "",
    "Datos actuales:",
  ];

  for (const [param, data] of Object.entries(input.airQuality)) {
    lines.push(`${param}: ${data.value} ${data.unit}`);
  }

  lines.push(`Viento: ${input.wind.speed} km/h del ${input.wind.directionEs}`);
  lines.push(`Temperatura: ${input.wind.temperature}C, Humedad: ${input.wind.humidity}%`);

  if (input.dispersion.affectedAreas.length > 0) {
    lines.push(`Dispersion: ${input.dispersion.description}`);
  }

  if (input.fires.count > 0) {
    lines.push(`Incendios: ${input.fires.summary}`);
  }

  lines.push("", "Resumen ciudadano:");
  return lines.join("\n");
}
