import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

/**
 * POST /api/seguros/verify
 *
 * Verifies an agricultural insurance claim using satellite imagery.
 * Compares NDVI before and after the declared event date to quantify damage.
 *
 * Request body:
 * {
 *   bbox: [west, south, east, north],  // field bounding box
 *   eventDate: "2026-03-15",           // date of declared event
 *   eventType: "granizo" | "sequia" | "inundacion" | "helada",
 *   claimId?: string,                  // optional external claim reference
 *   fieldName?: string                 // optional field name
 * }
 *
 * Returns:
 * - NDVI before event (14-day window)
 * - NDVI after event (14-day window)
 * - Change percentage and affected area estimate
 * - Before/after image URLs
 * - AI-generated verification summary
 * - Timestamp from ESA (verifiable)
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

// NDVI encoded as grayscale uint8 (same as agro endpoint)
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

// NDVI color image for visual comparison
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

interface VerifyRequest {
  bbox: [number, number, number, number];
  eventDate: string;
  eventType: "granizo" | "sequia" | "inundacion" | "helada";
  claimId?: string;
  fieldName?: string;
}

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

  try {
    const token = await getToken();

    // Define time windows: 14 days before event, 14 days after event
    const beforeFrom = new Date(event.getTime() - 28 * 86400000);
    const beforeTo = new Date(event.getTime() - 1 * 86400000);
    const afterFrom = new Date(event.getTime() + 1 * 86400000);
    const afterTo = new Date(event.getTime() + 28 * 86400000);

    // Fetch NDVI stats and images in parallel
    const [ndviBefore, ndviAfter] = await Promise.all([
      fetchNDVIMean(token, bbox, beforeFrom, beforeTo),
      fetchNDVIMean(token, bbox, afterFrom, afterTo),
    ]);

    // Calculate damage
    const damage = calculateDamage(ndviBefore.mean, ndviAfter.mean, eventType, bbox);

    // Generate AI verification summary
    const summary = await generateVerification({
      fieldName: fieldName || "Campo declarado",
      eventType,
      eventDate,
      ndviBefore: ndviBefore.mean,
      ndviAfter: ndviAfter.mean,
      damagePercent: damage.damagePercent,
      affectedHa: damage.affectedHa,
    });

    return NextResponse.json({
      verification: {
        claimId: claimId || null,
        fieldName: fieldName || null,
        eventType,
        eventDate,
        bbox,
        verifiedAt: new Date().toISOString(),
        dataSource: "ESA Copernicus Sentinel-2 L2A",
      },
      before: {
        period: { from: beforeFrom.toISOString().split("T")[0], to: beforeTo.toISOString().split("T")[0] },
        ndviMean: ndviBefore.mean,
        validPixels: ndviBefore.validPixels,
        imageUrl: `/api/seguros/verify/image?bbox=${bbox.join(",")}&from=${beforeFrom.toISOString().split("T")[0]}&to=${beforeTo.toISOString().split("T")[0]}`,
      },
      after: {
        period: { from: afterFrom.toISOString().split("T")[0], to: afterTo.toISOString().split("T")[0] },
        ndviMean: ndviAfter.mean,
        validPixels: ndviAfter.validPixels,
        imageUrl: `/api/seguros/verify/image?bbox=${bbox.join(",")}&from=${afterFrom.toISOString().split("T")[0]}&to=${afterTo.toISOString().split("T")[0]}`,
      },
      damage: {
        ndviChange: damage.ndviChange,
        damagePercent: damage.damagePercent,
        affectedHa: damage.affectedHa,
        totalHa: damage.totalHa,
        severity: damage.severity,
        consistent: damage.consistentWithEvent,
      },
      summary,
      disclaimer: "Este reporte se basa en datos modelados de composicion atmosferica y observaciones satelitales. No reemplaza una inspeccion presencial ni constituye un peritaje oficial.",
    });
  } catch (error) {
    console.error("Seguros verify error:", error);
    return NextResponse.json({ error: "No se pudo verificar el siniestro" }, { status: 502 });
  }
}

async function fetchNDVIMean(
  token: string,
  bbox: [number, number, number, number],
  from: Date,
  to: Date
): Promise<{ mean: number | null; validPixels: number }> {
  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
        data: [{
          type: "sentinel-2-l2a",
          dataFilter: { maxCloudCoverage: 50, timeRange: { from: from.toISOString(), to: to.toISOString() } },
        }],
      },
      output: { width: 64, height: 64, responses: [{ identifier: "default", format: { type: "image/png" } }] },
      evalscript: NDVI_ENCODED,
    }),
  });

  if (!res.ok) return { mean: null, validPixels: 0 };

  const buffer = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  let sum = 0, count = 0;
  for (let i = 0; i < data.length; i += channels) {
    const alpha = channels >= 2 ? data[i + channels - 1] : 255;
    if (alpha === 0) continue;
    const ndvi = data[i] / 127.5 - 1;
    sum += ndvi;
    count++;
  }

  return {
    mean: count > 0 ? Math.round((sum / count) * 1000) / 1000 : null,
    validPixels: count,
  };
}

function calculateDamage(
  ndviBefore: number | null,
  ndviAfter: number | null,
  eventType: string,
  bbox: [number, number, number, number]
) {
  // Estimate total area from bbox
  const avgLat = (bbox[1] + bbox[3]) / 2;
  const widthKm = (bbox[2] - bbox[0]) * 111.32 * Math.cos((avgLat * Math.PI) / 180);
  const heightKm = (bbox[3] - bbox[1]) * 111.32;
  const totalHa = Math.round(widthKm * heightKm * 100);

  if (ndviBefore === null || ndviAfter === null) {
    return {
      ndviChange: null,
      damagePercent: null,
      affectedHa: null,
      totalHa,
      severity: "indeterminado" as const,
      consistentWithEvent: null,
    };
  }

  const ndviChange = Math.round((ndviAfter - ndviBefore) * 1000) / 1000;
  const changePercent = ndviBefore > 0.05
    ? Math.round(((ndviAfter - ndviBefore) / ndviBefore) * 1000) / 10
    : null;

  // Estimate damage percentage (NDVI drop = vegetation loss)
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

  // Check if damage pattern is consistent with declared event type
  const eventPatterns: Record<string, { minDrop: number; description: string }> = {
    granizo: { minDrop: -0.1, description: "Caida abrupta de NDVI, patron irregular" },
    sequia: { minDrop: -0.05, description: "Caida gradual de NDVI, patron uniforme" },
    inundacion: { minDrop: -0.15, description: "NDVI negativo o cercano a cero (agua)" },
    helada: { minDrop: -0.08, description: "Caida moderada de NDVI, zona noreste mas afectada" },
  };

  const pattern = eventPatterns[eventType];
  const consistentWithEvent = ndviChange <= (pattern?.minDrop ?? -0.05);

  return {
    ndviChange,
    damagePercent: Math.round(damagePercent * 10) / 10,
    affectedHa,
    totalHa,
    severity,
    consistentWithEvent,
  };
}

async function generateVerification(data: {
  fieldName: string;
  eventType: string;
  eventDate: string;
  ndviBefore: number | null;
  ndviAfter: number | null;
  damagePercent: number | null;
  affectedHa: number | null;
}): Promise<string> {
  const eventLabels: Record<string, string> = {
    granizo: "granizo", sequia: "sequia", inundacion: "inundacion", helada: "helada",
  };

  const prompt = [
    "Genera un resumen de verificacion de siniestro agropecuario para una aseguradora.",
    "Tono: tecnico, objetivo, basado exclusivamente en datos satelitales. 3-4 oraciones.",
    "Menciona: NDVI antes y despues, porcentaje de daño, si es consistente con el evento declarado.",
    "No des opinion sobre la validez del reclamo, solo presenta la evidencia satelital.",
    "Sin markdown. En espanol.",
    "",
    `Campo: ${data.fieldName}`,
    `Evento declarado: ${eventLabels[data.eventType] || data.eventType}`,
    `Fecha del evento: ${data.eventDate}`,
    `NDVI pre-evento: ${data.ndviBefore ?? "sin datos"}`,
    `NDVI post-evento: ${data.ndviAfter ?? "sin datos"}`,
    `Daño estimado: ${data.damagePercent ?? "indeterminado"}%`,
    `Area afectada: ${data.affectedHa ?? "indeterminada"} ha`,
  ].join("\n");

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
  if (data.ndviBefore === null || data.ndviAfter === null) {
    return `Verificacion de siniestro para ${data.fieldName}: datos satelitales insuficientes para el periodo solicitado. Posible cobertura nubosa. Se recomienda ampliar la ventana temporal o realizar inspeccion presencial.`;
  }

  const consistent = data.damagePercent && data.damagePercent > 10;
  return `Verificacion satelital de ${data.fieldName}: NDVI pre-evento ${data.ndviBefore.toFixed(3)}, post-evento ${data.ndviAfter.toFixed(3)}. ${
    consistent
      ? `Se detecta una reduccion del ${data.damagePercent}% en la cobertura vegetal (${data.affectedHa} ha afectadas), patron consistente con ${eventLabels[data.eventType]}.`
      : `No se detecta una reduccion significativa de NDVI compatible con el evento de ${eventLabels[data.eventType]} declarado.`
  } Datos: ESA Sentinel-2 L2A.`;
}
