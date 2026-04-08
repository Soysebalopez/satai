/** Bahía Blanca bounding box and center */
export const BAHIA_BLANCA = {
  center: { lat: -38.7196, lng: -62.2724 },
  bounds: {
    north: -38.66,
    south: -38.78,
    east: -62.18,
    west: -62.38,
  },
  zoom: 12,
} as const;

/** WHO Air Quality Guidelines (µg/m³, 24h average) */
export const AQI_THRESHOLDS = {
  NO2: { good: 25, moderate: 50, bad: 100, dangerous: 200 },
  SO2: { good: 40, moderate: 80, bad: 250, dangerous: 500 },
  CO: { good: 4000, moderate: 7000, bad: 10000, dangerous: 17000 },
  O3: { good: 60, moderate: 100, bad: 140, dangerous: 180 },
  PM25: { good: 15, moderate: 25, bad: 50, dangerous: 75 },
} as const;

export type AirLevel = "good" | "moderate" | "bad" | "dangerous";

export function getAirLevel(pollutant: keyof typeof AQI_THRESHOLDS, value: number): AirLevel {
  const t = AQI_THRESHOLDS[pollutant];
  if (value <= t.good) return "good";
  if (value <= t.moderate) return "moderate";
  if (value <= t.bad) return "bad";
  return "dangerous";
}

export const AIR_LEVEL_LABELS: Record<AirLevel, string> = {
  good: "Bueno",
  moderate: "Moderado",
  bad: "Malo",
  dangerous: "Peligroso",
};

export const AIR_LEVEL_COLORS: Record<AirLevel, string> = {
  good: "#22c55e",
  moderate: "#eab308",
  bad: "#f97316",
  dangerous: "#ef4444",
};
