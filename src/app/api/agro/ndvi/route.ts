import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

/**
 * GET /api/agro/ndvi?bbox=-62.3,-38.8,-62.2,-38.7&weeks=2
 *
 * Returns NDVI statistics for a custom bounding box over the last N weeks.
 * Uses Sentinel Hub Statistical API to get mean NDVI per time period.
 */

const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }
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

// Evalscript that encodes NDVI as a grayscale PNG (0-255 maps to NDVI -1 to +1)
// Value 128 = NDVI 0, Value 255 = NDVI 1, Value 0 = NDVI -1
// Alpha channel: 255 = valid pixel, 0 = no data
const NDVI_ENCODED_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 2, sampleType: "UINT8" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0];
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  let encoded = Math.round((ndvi + 1) * 127.5);
  encoded = Math.max(0, Math.min(255, encoded));
  return [encoded, 255];
}`;

// Evalscript for NDVI color image
const NDVI_IMAGE_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B04", "B08", "dataMask"], output: { bands: 4 } };
}
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
  const weeks = Math.min(Number(params.get("weeks") || "4"), 12);
  const format = params.get("format") || "json"; // "json" or "image"

  if (!bboxStr) {
    return NextResponse.json({ error: "bbox requerido (west,south,east,north)" }, { status: 400 });
  }

  const bbox = bboxStr.split(",").map(Number) as [number, number, number, number];
  if (bbox.length !== 4 || bbox.some(isNaN)) {
    return NextResponse.json({ error: "bbox invalido" }, { status: 400 });
  }

  try {
    const token = await getToken();

    if (format === "image") {
      return await fetchNDVIImage(token, bbox);
    }

    return await fetchNDVIStats(token, bbox, weeks);
  } catch (error) {
    console.error("Agro NDVI API error:", error);
    return NextResponse.json({ error: "No se pudo obtener NDVI" }, { status: 502 });
  }
}

async function fetchNDVIImage(token: string, bbox: [number, number, number, number]) {
  const now = new Date();
  const from = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        bounds: {
          bbox,
          properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
        },
        data: [{
          type: "sentinel-2-l2a",
          dataFilter: { maxCloudCoverage: 30, timeRange: { from: from.toISOString(), to: now.toISOString() } },
        }],
      },
      output: {
        width: 512, height: 512,
        responses: [{ identifier: "default", format: { type: "image/png" } }],
      },
      evalscript: NDVI_IMAGE_EVALSCRIPT,
    }),
  });

  if (!res.ok) throw new Error(`Sentinel Hub: ${res.status}`);
  const buffer = await res.arrayBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}

async function fetchNDVIStats(token: string, bbox: [number, number, number, number], weeks: number) {
  const now = new Date();
  const periods: Array<{ from: string; to: string; label: string }> = [];

  for (let w = 0; w < weeks; w++) {
    const to = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    periods.push({
      from: from.toISOString(),
      to: to.toISOString(),
      label: `Semana ${weeks - w}`,
    });
  }
  periods.reverse();

  const results = await Promise.all(
    periods.map(async (period) => {
      try {
        const res = await fetch(PROCESS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: {
              bounds: {
                bbox,
                properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
              },
              data: [{
                type: "sentinel-2-l2a",
                dataFilter: {
                  maxCloudCoverage: 40,
                  timeRange: { from: period.from, to: period.to },
                },
              }],
            },
            output: {
              width: 64, height: 64,
              responses: [{ identifier: "default", format: { type: "image/png" } }],
            },
            evalscript: NDVI_ENCODED_EVALSCRIPT,
          }),
        });

        if (!res.ok) return { ...period, ndviMean: null };

        // Parse PNG with sharp — 2-channel (gray + alpha)
        const buffer = Buffer.from(await res.arrayBuffer());
        const { data, info } = await sharp(buffer)
          .raw()
          .toBuffer({ resolveWithObject: true });

        let sum = 0, count = 0;
        const channels = info.channels; // 2 (gray + alpha) or 4 (RGBA)

        for (let i = 0; i < data.length; i += channels) {
          const encodedNdvi = data[i]; // gray channel
          const alpha = channels >= 2 ? data[i + (channels - 1)] : 255;

          // Skip no-data pixels (alpha = 0)
          if (alpha === 0) continue;

          // Decode: encoded = (NDVI + 1) * 127.5, so NDVI = encoded / 127.5 - 1
          const ndvi = encodedNdvi / 127.5 - 1;
          sum += ndvi;
          count++;
        }

        const mean = count > 0 ? Math.round((sum / count) * 1000) / 1000 : null;
        return { ...period, ndviMean: mean };
      } catch (err) {
        console.error("NDVI stats fetch error:", err);
        return { ...period, ndviMean: null };
      }
    })
  );

  // Calculate changes — only when both values are meaningful
  const withChanges = results.map((r, i) => {
    const prev = i > 0 ? results[i - 1].ndviMean : null;
    const change =
      r.ndviMean !== null && prev !== null && Math.abs(prev) > 0.05
        ? Math.round(((r.ndviMean - prev) / Math.abs(prev)) * 1000) / 10
        : null;

    let status: "ok" | "warning" | "alert" = "ok";
    if (change !== null) {
      if (change < -15) status = "alert";
      else if (change < -8) status = "warning";
    }

    return { ...r, ndviChange: change, status };
  });

  return NextResponse.json({
    bbox,
    weeks,
    periods: withChanges,
    current: withChanges[withChanges.length - 1],
  });
}
