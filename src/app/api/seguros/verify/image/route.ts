import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/seguros/verify/image?bbox=...&from=...&to=...&type=inundacion
 *
 * Returns visualization image appropriate for the event type:
 * - inundacion: NDWI-based water detection (blue = water)
 * - others: NDVI vegetation (green = healthy)
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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const bboxStr = params.get("bbox");
  const from = params.get("from");
  const to = params.get("to");
  const eventType = params.get("type") || "sequia";

  if (!bboxStr || !from || !to) {
    return NextResponse.json({ error: "Requeridos: bbox, from, to" }, { status: 400 });
  }

  const bbox = bboxStr.split(",").map(Number);
  const evalscript = eventType === "inundacion" ? FLOOD_VISUAL : NDVI_VISUAL;

  try {
    const token = await getToken();

    const res = await fetch(PROCESS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: {
          bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
          data: [{
            type: "sentinel-2-l2a",
            dataFilter: {
              maxCloudCoverage: 60,
              timeRange: { from: new Date(from + "T00:00:00Z").toISOString(), to: new Date(to + "T23:59:59Z").toISOString() },
            },
          }],
        },
        output: { width: 512, height: 512, responses: [{ identifier: "default", format: { type: "image/png" } }] },
        evalscript,
      }),
    });

    if (!res.ok) throw new Error(`Sentinel Hub: ${res.status}`);
    const buffer = await res.arrayBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  } catch (error) {
    console.error("Seguros image error:", error);
    return NextResponse.json({ error: "No se pudo obtener la imagen" }, { status: 502 });
  }
}
