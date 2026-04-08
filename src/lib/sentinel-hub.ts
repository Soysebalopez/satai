import { BAHIA_BLANCA } from "./constants";

const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
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

  if (!res.ok) throw new Error(`Sentinel Hub auth failed: ${res.status}`);
  const data = await res.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

/** Evalscripts for different visualization types */
const EVALSCRIPTS = {
  trueColor: `//VERSION=3
function setup() {
  return { input: ["B04", "B03", "B02"], output: { bands: 3 } };
}
function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
}`,

  ndvi: `//VERSION=3
function setup() {
  return { input: ["B04", "B08"], output: { bands: 3 } };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  if (ndvi < -0.2) return [0.05, 0.05, 0.3];    // Water — dark blue
  if (ndvi < 0.0)  return [0.6, 0.5, 0.4];       // Bare soil — brown
  if (ndvi < 0.1)  return [0.8, 0.7, 0.5];       // Rock/sand — light brown
  if (ndvi < 0.2)  return [0.75, 0.85, 0.55];    // Sparse veg — yellow-green
  if (ndvi < 0.4)  return [0.4, 0.7, 0.2];       // Moderate veg — green
  if (ndvi < 0.6)  return [0.1, 0.5, 0.1];       // Dense veg — dark green
  return [0.0, 0.35, 0.0];                        // Very dense — forest green
}`,

  moisture: `//VERSION=3
function setup() {
  return { input: ["B8A", "B11"], output: { bands: 3 } };
}
function evaluatePixel(sample) {
  let ndmi = (sample.B8A - sample.B11) / (sample.B8A + sample.B11);
  if (ndmi < -0.2) return [0.8, 0.2, 0.1];       // Very dry — red
  if (ndmi < 0.0)  return [0.9, 0.6, 0.2];       // Dry — orange
  if (ndmi < 0.2)  return [0.9, 0.9, 0.3];       // Moderate — yellow
  if (ndmi < 0.4)  return [0.3, 0.7, 0.9];       // Moist — light blue
  return [0.1, 0.3, 0.8];                         // Wet — blue
}`,
} as const;

export type SatelliteLayer = keyof typeof EVALSCRIPTS;

interface FetchImageOptions {
  layer: SatelliteLayer;
  width?: number;
  height?: number;
  maxCloudCoverage?: number;
  fromDate?: string;
  toDate?: string;
}

/**
 * Fetches a Sentinel-2 processed image from Sentinel Hub.
 * Returns raw PNG buffer.
 */
export async function fetchSentinelImage(options: FetchImageOptions): Promise<Buffer> {
  const {
    layer,
    width = 512,
    height = 512,
    maxCloudCoverage = 30,
    fromDate,
    toDate,
  } = options;

  const token = await getAccessToken();
  const now = new Date();
  const defaultTo = toDate || now.toISOString();
  const defaultFrom = fromDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const body = {
    input: {
      bounds: {
        bbox: [
          BAHIA_BLANCA.bounds.west,
          BAHIA_BLANCA.bounds.south,
          BAHIA_BLANCA.bounds.east,
          BAHIA_BLANCA.bounds.north,
        ],
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            maxCloudCoverage,
            timeRange: { from: defaultFrom, to: defaultTo },
          },
        },
      ],
    },
    output: {
      width,
      height,
      responses: [{ identifier: "default", format: { type: "image/png" } }],
    },
    evalscript: EVALSCRIPTS[layer],
  };

  const res = await fetch(PROCESS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Sentinel Hub process failed (${res.status}): ${errorText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
