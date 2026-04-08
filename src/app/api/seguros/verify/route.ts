import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

/**
 * POST /api/seguros/verify
 *
 * Verifies agricultural insurance claims using satellite imagery.
 *
 * CRITICAL: Uses different indices per event type:
 * - granizo/sequia/helada → NDVI (vegetation loss)
 * - inundacion → NDWI (water detection) — water presence, not vegetation
 *
 * Time windows are also event-specific:
 * - inundacion: short post-event window (1-10 days) to catch standing water
 * - sequia: longer windows (28 days) for gradual changes
 * - granizo/helada: medium windows (14 days)
 */

const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) return cachedToken.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SENTINELHUB_CLIENT_ID!,
      client_secret: process.env.SENTINELHUB_CLIENT_SECRET!,
    }),
  });
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// NDVI encoded as uint8 — for granizo, sequia, helada
const NDVI_ENCODED = `//VERSION=3
function setup() {
  return { input: ["B04", "B08", "dataMask"], output: { bands: 2, sampleType: "UINT8" } };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0];
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  let enc = Math.round((ndvi + 1) * 127.5);
  return [Math.max(0, Math.min(255, enc)), 255];
}`;

// NDWI (Normalized Difference Water Index) encoded as uint8 — for inundacion
// NDWI = (Green - NIR) / (Green + NIR) = (B03 - B08) / (B03 + B08)
// Water: NDWI > 0.3 | Vegetation: NDWI < 0 | Soil: NDWI 0-0.2
const NDWI_ENCODED = `//VERSION=3
function setup() {
  return { input: ["B03", "B08", "dataMask"], output: { bands: 2, sampleType: "UINT8" } };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0];
  let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08);
  let enc = Math.round((ndwi + 1) * 127.5);
  return [Math.max(0, Math.min(255, enc)), 255];
}`;

// Visual image for inundacion — highlights water in blue
const FLOOD_VISUAL = `//VERSION=3
function setup() { return { input: ["B03", "B08", "B04", "B02", "dataMask"], output: { bands: 4 } }; }
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08);
  if (ndwi > 0.3)  return [0.05, 0.1, 0.6, 1];
  if (ndwi > 0.1)  return [0.2, 0.35, 0.7, 1];
  if (ndwi > 0.0)  return [0.5, 0.6, 0.5, 1];
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, 1];
}`;

// NDVI visual for non-flood events
const NDVI_VISUAL = `//VERSION=3
function setup() { return { input: ["B04", "B08", "dataMask"], output: { bands: 4 } }; }
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0, 0];
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  if (ndvi < -0.2) return [0.05, 0.05, 0.3, 1];
  if (ndvi < 0.0)  return [0.6, 0.5, 0.4, 1];
  if (ndvi < 0.1)  return [0.8, 0.7, 0.5, 1];
  if (ndvi < 0.2)  return [0.75, 0.85, 0.55, 1];
  if (ndvi < 0.4)  return [0.4, 0.7, 0.2, 1];
  if (ndvi < 0.6)  return [0.1, 0.5, 0.1, 1];
  return [0.0, 0.35, 0.0, 1];
}`;

type EventType = "granizo" | "sequia" | "inundacion" | "helada";

interface VerifyRequest {
  bbox: [number, number, number, number];
  eventDate: string;
  eventType: EventType;
  claimId?: string;
  fieldName?: string;
}

// Event-specific time windows and analysis strategy
const EVENT_CONFIG: Record<EventType, {
  beforeDays: number;
  afterDays: number;
  index: "ndvi" | "ndwi";
  evalscript: string;
  visualScript: string;
  indexLabel: string;
}> = {
  granizo: { beforeDays: 14, afterDays: 14, index: "ndvi", evalscript: NDVI_ENCODED, visualScript: NDVI_VISUAL, indexLabel: "NDVI" },
  sequia: { beforeDays: 28, afterDays: 28, index: "ndvi", evalscript: NDVI_ENCODED, visualScript: NDVI_VISUAL, indexLabel: "NDVI" },
  helada: { beforeDays: 14, afterDays: 14, index: "ndvi", evalscript: NDVI_ENCODED, visualScript: NDVI_VISUAL, indexLabel: "NDVI" },
  inundacion: { beforeDays: 14, afterDays: 5, index: "ndwi", evalscript: NDWI_ENCODED, visualScript: FLOOD_VISUAL, indexLabel: "NDWI" },
};

export async function POST(request: NextRequest) {
  const body: VerifyRequest = await request.json();
  const { bbox, eventDate, eventType, claimId, fieldName } = body;

  if (!bbox || bbox.length !== 4 || !eventDate || !eventType) {
    return NextResponse.json(
      { error: "Requeridos: bbox [w,s,e,n], eventDate (YYYY-MM-DD), eventType" },
      { status: 400 }
    );
  }

  const event = new Date(eventDate + "T12:00:00Z");
  if (isNaN(event.getTime())) {
    return NextResponse.json({ error: "Fecha invalida" }, { status: 400 });
  }

  const config = EVENT_CONFIG[eventType];

  try {
    const token = await getToken();

    // Time windows — event-specific
    const beforeFrom = new Date(event.getTime() - config.beforeDays * 86400000);
    const beforeTo = new Date(event.getTime() - 1 * 86400000);
    const afterFrom = new Date(event.getTime() + 1 * 86400000);
    const afterTo = new Date(event.getTime() + config.afterDays * 86400000);

    // Calculate area for warnings
    const avgLat = (bbox[1] + bbox[3]) / 2;
    const widthKm = (bbox[2] - bbox[0]) * 111.32 * Math.cos((avgLat * Math.PI) / 180);
    const heightKm = (bbox[3] - bbox[1]) * 111.32;
    const totalHa = Math.round(widthKm * heightKm * 100);

    const warnings: string[] = [];
    if (totalHa < 20) {
      warnings.push(`Area muy pequena (${totalHa} ha). Sentinel-2 tiene resolucion de 10m/pixel. Para inundaciones urbanas se recomienda un area de al menos 50 ha.`);
    }

    // Fetch primary index (NDVI or NDWI)
    const [indexBefore, indexAfter] = await Promise.all([
      fetchIndexMean(token, bbox, beforeFrom, beforeTo, config.evalscript),
      fetchIndexMean(token, bbox, afterFrom, afterTo, config.evalscript),
    ]);

    // For inundaciones: also check NDVI drop as secondary evidence
    // Flooded vegetation has NDVI near 0 or negative
    let ndviBefore: { mean: number | null; validPixels: number } | null = null;
    let ndviAfter: { mean: number | null; validPixels: number } | null = null;
    if (eventType === "inundacion") {
      [ndviBefore, ndviAfter] = await Promise.all([
        fetchIndexMean(token, bbox, beforeFrom, beforeTo, NDVI_ENCODED),
        fetchIndexMean(token, bbox, afterFrom, afterTo, NDVI_ENCODED),
      ]);
    }

    // Calculate damage — uses water pixel % for floods
    const damage = calculateDamage(
      indexBefore.mean, indexAfter.mean, eventType, bbox, config.index,
      ndviBefore?.mean, ndviAfter?.mean,
      indexBefore.waterPixelPercent, indexAfter.waterPixelPercent,
    );

    if (eventType === "inundacion" && !damage.consistentWithEvent && totalHa < 20) {
      warnings.push("La deteccion puede ser imprecisa en zonas urbanas pequenas. Se recomienda ampliar el area de analisis o complementar con imagenes de radar SAR (Sentinel-1).");
    }

    const summary = await generateVerification({
      fieldName: fieldName || "Campo declarado",
      eventType,
      eventDate,
      indexName: config.indexLabel,
      indexBefore: indexBefore.mean,
      indexAfter: indexAfter.mean,
      damagePercent: damage.damagePercent,
      affectedHa: damage.affectedHa,
      waterDetected: damage.waterDetected,
      warnings,
    });

    return NextResponse.json({
      verification: {
        claimId: claimId || null,
        fieldName: fieldName || null,
        eventType,
        eventDate,
        bbox,
        indexUsed: config.indexLabel,
        verifiedAt: new Date().toISOString(),
        dataSource: "ESA Copernicus Sentinel-2 L2A",
      },
      before: {
        period: { from: formatDate(beforeFrom), to: formatDate(beforeTo) },
        indexMean: indexBefore.mean,
        indexName: config.indexLabel,
        validPixels: indexBefore.validPixels,
        waterPixelPercent: indexBefore.waterPixelPercent,
        imageUrl: `/api/seguros/verify/image?bbox=${bbox.join(",")}&from=${formatDate(beforeFrom)}&to=${formatDate(beforeTo)}&type=${eventType}`,
      },
      after: {
        period: { from: formatDate(afterFrom), to: formatDate(afterTo) },
        indexMean: indexAfter.mean,
        indexName: config.indexLabel,
        validPixels: indexAfter.validPixels,
        waterPixelPercent: indexAfter.waterPixelPercent,
        imageUrl: `/api/seguros/verify/image?bbox=${bbox.join(",")}&from=${formatDate(afterFrom)}&to=${formatDate(afterTo)}&type=${eventType}`,
      },
      damage: {
        indexChange: damage.indexChange,
        damagePercent: damage.damagePercent,
        affectedHa: damage.affectedHa,
        totalHa: damage.totalHa,
        severity: damage.severity,
        consistent: damage.consistentWithEvent,
        waterDetected: damage.waterDetected,
        waterPixelsBefore: damage.waterPixelsBefore || 0,
        waterPixelsAfter: damage.waterPixelsAfter || 0,
        methodology: eventType === "inundacion"
          ? `Conteo de pixeles con agua (NDWI > 0.1): antes ${indexBefore.waterPixelPercent}%, despues ${indexAfter.waterPixelPercent}%. Complementado con analisis NDVI.`
          : "Comparacion de NDVI pre/post evento. Reduccion indica perdida de cobertura vegetal.",
      },
      summary,
      warnings: warnings.length > 0 ? warnings : undefined,
      disclaimer: eventType === "inundacion" && !damage.waterDetected
        ? "LIMITACION: Sentinel-2 (sensor optico) no puede ver a traves de nubes. Durante inundaciones, la cobertura nubosa frecuentemente impide la captura de imagenes. Ademas, el agua turbia urbana tiene respuesta espectral diferente al agua limpia. Para verificacion confiable de inundaciones se recomienda complementar con datos Sentinel-1 SAR (radar). Este reporte NO es concluyente para eventos de inundacion."
        : "Este reporte se basa en observaciones satelitales Sentinel-2. No reemplaza una inspeccion presencial ni constituye un peritaje oficial.",
    });
  } catch (error) {
    console.error("Seguros verify error:", error);
    return NextResponse.json({ error: "No se pudo verificar el siniestro" }, { status: 502 });
  }
}

async function fetchIndexMean(
  token: string,
  bbox: [number, number, number, number],
  from: Date,
  to: Date,
  evalscript: string,
): Promise<{ mean: number | null; validPixels: number; waterPixelPercent: number }> {
  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
        data: [{
          type: "sentinel-2-l2a",
          dataFilter: { maxCloudCoverage: 80, timeRange: { from: from.toISOString(), to: to.toISOString() } },
        }],
      },
      output: { width: 128, height: 128, responses: [{ identifier: "default", format: { type: "image/png" } }] },
      evalscript,
    }),
  });

  if (!res.ok) return { mean: null, validPixels: 0, waterPixelPercent: 0 };

  const buffer = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  let sum = 0, count = 0, waterPixels = 0;
  for (let i = 0; i < data.length; i += channels) {
    const alpha = channels >= 2 ? data[i + channels - 1] : 255;
    if (alpha === 0) continue;
    const decoded = data[i] / 127.5 - 1;
    sum += decoded;
    count++;
    // Count water pixels: NDWI > 0.1 indicates water
    if (decoded > 0.1) waterPixels++;
  }

  return {
    mean: count > 0 ? Math.round((sum / count) * 1000) / 1000 : null,
    validPixels: count,
    waterPixelPercent: count > 0 ? Math.round((waterPixels / count) * 1000) / 10 : 0,
  };
}

function calculateDamage(
  indexBefore: number | null,
  indexAfter: number | null,
  eventType: EventType,
  bbox: [number, number, number, number],
  indexType: "ndvi" | "ndwi",
  ndviBefore?: number | null,
  ndviAfter?: number | null,
  waterPixelsBefore?: number,
  waterPixelsAfter?: number,
) {
  const avgLat = (bbox[1] + bbox[3]) / 2;
  const widthKm = (bbox[2] - bbox[0]) * 111.32 * Math.cos((avgLat * Math.PI) / 180);
  const heightKm = (bbox[3] - bbox[1]) * 111.32;
  const totalHa = Math.round(widthKm * heightKm * 100);

  if (indexBefore === null || indexAfter === null) {
    return {
      indexChange: null, damagePercent: null, affectedHa: null, totalHa,
      severity: "indeterminado" as const, consistentWithEvent: null, waterDetected: false,
      waterPixelsBefore: waterPixelsBefore || 0,
      waterPixelsAfter: waterPixelsAfter || 0,
    };
  }

  const indexChange = Math.round((indexAfter - indexBefore) * 1000) / 1000;

  if (eventType === "inundacion") {
    // PRIMARY METHOD: Count water pixels (NDWI > 0.1)
    // This is much more reliable than mean NDWI for urban areas
    const wpBefore = waterPixelsBefore || 0;
    const wpAfter = waterPixelsAfter || 0;
    const waterPixelIncrease = wpAfter - wpBefore;

    // SECONDARY: Check if NDVI dropped (flooded land has low NDVI)
    const ndviDrop = (ndviBefore != null && ndviAfter != null)
      ? ndviBefore - ndviAfter : 0;

    // Water detected if: more water pixels after, OR significant NDVI drop
    const waterDetected = waterPixelIncrease > 2 || wpAfter > 5 || ndviDrop > 0.1;

    // Damage based on water pixel increase (most reliable signal)
    let damagePercent = 0;
    if (waterPixelIncrease > 20) damagePercent = Math.min(95, waterPixelIncrease);
    else if (waterPixelIncrease > 10) damagePercent = waterPixelIncrease * 1.5;
    else if (waterPixelIncrease > 5) damagePercent = waterPixelIncrease * 2;
    else if (wpAfter > 15) damagePercent = wpAfter * 0.8; // Absolute water presence
    else if (wpAfter > 5) damagePercent = wpAfter;
    else if (ndviDrop > 0.15) damagePercent = 30; // NDVI evidence only
    else if (ndviDrop > 0.08) damagePercent = 15;
    else if (waterDetected) damagePercent = 10;

    damagePercent = Math.min(100, Math.max(0, damagePercent));
    const affectedHa = Math.round(totalHa * (damagePercent / 100));

    let severity: "ninguno" | "leve" | "moderado" | "severo" | "total";
    if (damagePercent < 5) severity = "ninguno";
    else if (damagePercent < 20) severity = "leve";
    else if (damagePercent < 45) severity = "moderado";
    else if (damagePercent < 75) severity = "severo";
    else severity = "total";

    return {
      indexChange,
      damagePercent: Math.round(damagePercent * 10) / 10,
      affectedHa,
      totalHa,
      severity,
      consistentWithEvent: waterDetected,
      waterDetected,
      waterPixelsBefore: wpBefore,
      waterPixelsAfter: wpAfter,
    };
  }

  // For granizo, sequia, helada: NDVI DECREASE means vegetation loss
  const changePercent = Math.abs(indexBefore) > 0.05
    ? Math.round(((indexAfter - indexBefore) / Math.abs(indexBefore)) * 1000) / 10
    : null;

  const damagePercent = changePercent !== null && changePercent < 0
    ? Math.min(100, Math.abs(changePercent))
    : 0;

  const affectedHa = Math.round(totalHa * (damagePercent / 100));

  let severity: "ninguno" | "leve" | "moderado" | "severo" | "total";
  if (damagePercent < 5) severity = "ninguno";
  else if (damagePercent < 15) severity = "leve";
  else if (damagePercent < 35) severity = "moderado";
  else if (damagePercent < 70) severity = "severo";
  else severity = "total";

  const minDrop: Record<string, number> = { granizo: -0.1, sequia: -0.05, helada: -0.08 };
  const consistentWithEvent = indexChange <= (minDrop[eventType] ?? -0.05);

  return {
    indexChange,
    damagePercent: Math.round(damagePercent * 10) / 10,
    affectedHa,
    totalHa,
    severity,
    consistentWithEvent,
    waterDetected: false,
  };
}

async function generateVerification(data: {
  fieldName: string;
  eventType: string;
  eventDate: string;
  indexName: string;
  indexBefore: number | null;
  indexAfter: number | null;
  damagePercent: number | null;
  affectedHa: number | null;
  waterDetected: boolean;
  warnings?: string[];
}): Promise<string> {
  const eventLabels: Record<string, string> = {
    granizo: "granizo", sequia: "sequia", inundacion: "inundacion", helada: "helada",
  };

  const isFlood = data.eventType === "inundacion";

  const prompt = [
    "Genera un resumen de verificacion de siniestro agropecuario para una aseguradora.",
    "Tono: tecnico, objetivo, basado exclusivamente en datos satelitales. 3-4 oraciones.",
    isFlood
      ? "Se usa NDWI (Water Index) para detectar agua. Un aumento de NDWI indica presencia de agua superficial (inundacion)."
      : "Se usa NDVI para medir vegetacion. Una reduccion indica perdida de cobertura vegetal.",
    "No des opinion sobre la validez del reclamo, solo presenta la evidencia satelital.",
    "Sin markdown. En espanol.",
    "",
    `Campo: ${data.fieldName}`,
    `Evento declarado: ${eventLabels[data.eventType] || data.eventType}`,
    `Fecha del evento: ${data.eventDate}`,
    `${data.indexName} pre-evento: ${data.indexBefore ?? "sin datos"}`,
    `${data.indexName} post-evento: ${data.indexAfter ?? "sin datos"}`,
    isFlood && data.waterDetected ? "AGUA DETECTADA en imagen post-evento" : "",
    `Daño estimado: ${data.damagePercent ?? "indeterminado"}%`,
    `Area afectada: ${data.affectedHa ?? "indeterminada"} ha`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemma3:4b", prompt, stream: false,
        options: { temperature: 0.2, num_predict: 250 },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.response?.trim()) return result.response.trim();
    }
  } catch {}

  // Template fallback
  if (data.indexBefore === null || data.indexAfter === null) {
    return `Verificacion de siniestro para ${data.fieldName}: datos satelitales insuficientes para el periodo solicitado. Se recomienda ampliar la ventana temporal o realizar inspeccion presencial.`;
  }

  if (isFlood) {
    return data.waterDetected
      ? `Verificacion satelital de ${data.fieldName}: se detecta presencia de agua superficial post-evento. ${data.indexName} aumento de ${data.indexBefore.toFixed(3)} a ${data.indexAfter.toFixed(3)}, indicando inundacion. Area afectada estimada: ${data.affectedHa} ha (${data.damagePercent}%). Datos: ESA Sentinel-2 L2A.`
      : `Verificacion satelital de ${data.fieldName}: no se detecta presencia significativa de agua superficial post-evento. ${data.indexName} pre: ${data.indexBefore.toFixed(3)}, post: ${data.indexAfter.toFixed(3)}. Datos: ESA Sentinel-2 L2A.`;
  }

  const consistent = data.damagePercent && data.damagePercent > 10;
  return `Verificacion satelital de ${data.fieldName}: ${data.indexName} pre-evento ${data.indexBefore.toFixed(3)}, post-evento ${data.indexAfter.toFixed(3)}. ${
    consistent
      ? `Reduccion del ${data.damagePercent}% (${data.affectedHa} ha afectadas), patron consistente con ${eventLabels[data.eventType]}.`
      : `No se detecta reduccion significativa compatible con ${eventLabels[data.eventType]}.`
  } Datos: ESA Sentinel-2 L2A.`;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
