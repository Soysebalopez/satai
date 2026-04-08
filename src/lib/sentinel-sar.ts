import sharp from "sharp";

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

/** Encodes VV backscatter as uint8 for statistical analysis */
const SAR_ENCODED = `//VERSION=3
function setup() {
  return { input: ["VV", "dataMask"], output: { bands: 2, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  if (s.dataMask === 0) return [0, 0];
  let enc = Math.round(Math.min(1, s.VV * 5) * 255);
  return [enc, 255];
}`;

/** Visual: confirmed water in blue, possible water in light blue, land in grayscale */
const SAR_FLOOD_VISUAL = `//VERSION=3
function setup() { return { input: ["VV", "dataMask"], output: { bands: 3 } }; }
function evaluatePixel(s) {
  if (s.dataMask === 0) return [0, 0, 0];
  let vv = s.VV;
  if (vv < 0.016) return [0.05, 0.1, 0.7];
  if (vv < 0.03)  return [0.2, 0.3, 0.55];
  if (vv < 0.06)  return [0.4, 0.45, 0.5];
  return [Math.min(1, 3*vv), Math.min(1, 3*vv), Math.min(1, 3*vv)];
}`;

export interface SARFloodResult {
  waterPixelsBefore: number;
  waterPixelsAfter: number;
  waterPercentBefore: number;
  waterPercentAfter: number;
  waterIncrease: number;
  floodDetected: boolean;
  severity: "ninguno" | "leve" | "moderado" | "severo" | "total";
  damagePercent: number;
}

/**
 * Analyzes flood using Sentinel-1 SAR (radar).
 * Counts water pixels (low VV backscatter) before and after event.
 * Works through clouds — this is the reliable flood detection method.
 */
export async function analyzeSARFlood(
  bbox: [number, number, number, number],
  eventDate: string,
  beforeDays = 21,
  afterDays = 12,
): Promise<SARFloodResult> {
  const token = await getToken();
  const event = new Date(eventDate + "T12:00:00Z");

  const beforeFrom = new Date(event.getTime() - beforeDays * 86400000);
  const beforeTo = new Date(event.getTime() - 1 * 86400000);
  const afterFrom = new Date(event.getTime());
  const afterTo = new Date(event.getTime() + afterDays * 86400000);

  const [before, after] = await Promise.all([
    fetchSARStats(token, bbox, beforeFrom, beforeTo),
    fetchSARStats(token, bbox, afterFrom, afterTo),
  ]);

  const waterIncrease = after.waterPercent - before.waterPercent;
  // With strict threshold (~-19 dB), baseline is ~0.2%, flood is 5-15%+
  const floodDetected = waterIncrease > 2 || (after.waterPercent > 3 && waterIncrease > 1);

  let damagePercent = 0;
  if (waterIncrease > 15) damagePercent = 90;
  else if (waterIncrease > 10) damagePercent = 70;
  else if (waterIncrease > 6) damagePercent = 50;
  else if (waterIncrease > 3) damagePercent = 30;
  else if (waterIncrease > 1.5) damagePercent = 15;
  else if (floodDetected) damagePercent = 10;

  let severity: SARFloodResult["severity"];
  if (damagePercent < 5) severity = "ninguno";
  else if (damagePercent < 20) severity = "leve";
  else if (damagePercent < 45) severity = "moderado";
  else if (damagePercent < 75) severity = "severo";
  else severity = "total";

  return {
    waterPixelsBefore: before.waterCount,
    waterPixelsAfter: after.waterCount,
    waterPercentBefore: before.waterPercent,
    waterPercentAfter: after.waterPercent,
    waterIncrease: Math.round(waterIncrease * 10) / 10,
    floodDetected,
    severity,
    damagePercent: Math.round(damagePercent * 10) / 10,
  };
}

async function fetchSARStats(
  token: string,
  bbox: [number, number, number, number],
  from: Date,
  to: Date,
): Promise<{ waterCount: number; totalPixels: number; waterPercent: number }> {
  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
        data: [{
          type: "sentinel-1-grd",
          dataFilter: { timeRange: { from: from.toISOString(), to: to.toISOString() } },
          processing: { orthorectify: true, backCoeff: "SIGMA0_ELLIPSOID" },
        }],
      },
      output: { width: 128, height: 128, responses: [{ identifier: "default", format: { type: "image/png" } }] },
      evalscript: SAR_ENCODED,
    }),
  });

  if (!res.ok) return { waterCount: 0, totalPixels: 0, waterPercent: 0 };

  const buffer = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  let total = 0, water = 0;
  for (let i = 0; i < data.length; i += ch) {
    const alpha = ch >= 2 ? data[i + ch - 1] : 255;
    if (alpha === 0) continue;
    total++;
    if (data[i] < 20) water++; // VV < 0.016 linear (~-18 dB) = confirmed water
  }

  return {
    waterCount: water,
    totalPixels: total,
    waterPercent: total > 0 ? Math.round((water / total) * 1000) / 10 : 0,
  };
}

/**
 * Fetches SAR flood visual image (water in blue, land in gray).
 */
export async function fetchSARFloodImage(
  bbox: [number, number, number, number],
  from: string,
  to: string,
): Promise<Buffer> {
  const token = await getToken();

  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
        data: [{
          type: "sentinel-1-grd",
          dataFilter: { timeRange: { from: new Date(from).toISOString(), to: new Date(to).toISOString() } },
          processing: { orthorectify: true, backCoeff: "SIGMA0_ELLIPSOID" },
        }],
      },
      output: { width: 512, height: 512, responses: [{ identifier: "default", format: { type: "image/png" } }] },
      evalscript: SAR_FLOOD_VISUAL,
    }),
  });

  if (!res.ok) throw new Error(`SAR image failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
