/**
 * Simplified Gaussian plume dispersion model.
 *
 * Models how a pollutant cloud spreads from a point source
 * based on wind speed, direction, and atmospheric stability.
 *
 * Reference: Pasquill-Gifford stability classes (simplified)
 */

export interface DispersionInput {
  /** Source coordinates [lng, lat] */
  source: [number, number];
  /** Wind direction in degrees (FROM where the wind blows) */
  windDirection: number;
  /** Wind speed in km/h */
  windSpeed: number;
  /** Wind gusts in km/h */
  windGusts: number;
  /** Event type affects emission characteristics */
  eventType: "fuga_gas" | "incendio_industrial" | "derrame";
  /** Simulation duration in minutes */
  durationMinutes: number;
}

export interface DispersionResult {
  /** Plume polygon coordinates for each concentration level */
  plumes: Array<{
    level: "high" | "medium" | "low";
    label: string;
    color: string;
    opacity: number;
    polygon: [number, number][]; // [lng, lat] pairs
    reachesZones: string[];
    etaMinutes: number; // time for plume to reach this distance
  }>;
  /** Wind arrow direction for display */
  windBearing: number;
  /** Affected zones with ETA */
  affectedZones: Array<{
    name: string;
    distanceKm: number;
    etaMinutes: number;
    concentrationLevel: "high" | "medium" | "low" | "none";
  }>;
  /** Summary */
  summary: string;
}

// Bahía Blanca zones for impact analysis
const BB_ZONES = [
  { name: "Ingeniero White", lat: -38.7826, lng: -62.2614 },
  { name: "Centro", lat: -38.7196, lng: -62.2724 },
  { name: "Villa Mitre", lat: -38.7050, lng: -62.2900 },
  { name: "Noroeste", lat: -38.7350, lng: -62.3050 },
  { name: "Grünbein", lat: -38.7550, lng: -62.2950 },
  { name: "Universitario", lat: -38.7100, lng: -62.2500 },
  { name: "Palihue", lat: -38.7250, lng: -62.2450 },
  { name: "Villa Floresta", lat: -38.7350, lng: -62.3200 },
];

// Event type emission parameters
const EVENT_PARAMS: Record<string, { spreadFactor: number; heightM: number; label: string }> = {
  fuga_gas: { spreadFactor: 1.2, heightM: 5, label: "Fuga de gas" },
  incendio_industrial: { spreadFactor: 1.0, heightM: 50, label: "Incendio industrial" },
  derrame: { spreadFactor: 0.6, heightM: 2, label: "Derrame" },
};

/**
 * Calculate dispersion plume geometry and affected zones.
 */
export function calculateDispersion(input: DispersionInput): DispersionResult {
  const { source, windDirection, windSpeed, windGusts, eventType, durationMinutes } = input;
  const params = EVENT_PARAMS[eventType] || EVENT_PARAMS.fuga_gas;

  // Wind direction: meteorological convention is FROM where wind blows
  // Plume travels in the opposite direction
  const plumeBearing = (windDirection + 180) % 360;
  const bearingRad = (plumeBearing * Math.PI) / 180;

  // Convert wind speed to m/s
  const windMs = windSpeed / 3.6;
  const gustMs = windGusts / 3.6;

  // Calculate plume distances for each concentration level
  // Using simplified Pasquill-Gifford: distance = windSpeed * time * spreadFactor
  const distances = {
    high: Math.min(windMs * durationMinutes * 60 * 0.3 * params.spreadFactor, 5000) / 1000, // km
    medium: Math.min(windMs * durationMinutes * 60 * 0.6 * params.spreadFactor, 12000) / 1000,
    low: Math.min(gustMs * durationMinutes * 60 * 0.9 * params.spreadFactor, 25000) / 1000,
  };

  // Plume width increases with distance (lateral spread)
  const spreadAngle = {
    high: 15, // degrees from centerline
    medium: 25,
    low: 40,
  };

  // Generate plume polygons
  const plumes = (["high", "medium", "low"] as const).map((level) => {
    const dist = distances[level];
    const angle = spreadAngle[level];
    const polygon = generatePlumePolygon(source, bearingRad, dist, angle);
    const etaMinutes = windMs > 0 ? Math.round((dist * 1000) / windMs / 60) : 999;

    const reachesZones = BB_ZONES
      .filter((zone) => isPointInPlume(zone.lng, zone.lat, source, bearingRad, dist, angle))
      .map((z) => z.name);

    const config = {
      high: { label: "Alta concentracion", color: "#ef4444", opacity: 0.35 },
      medium: { label: "Concentracion media", color: "#f97316", opacity: 0.25 },
      low: { label: "Baja concentracion", color: "#eab308", opacity: 0.15 },
    };

    return {
      level,
      ...config[level],
      polygon,
      reachesZones,
      etaMinutes,
    };
  });

  // Calculate per-zone impact
  const affectedZones = BB_ZONES.map((zone) => {
    const distKm = haversineKm(source[1], source[0], zone.lat, zone.lng);
    const etaMinutes = windMs > 0 ? Math.round((distKm * 1000) / windMs / 60) : 999;

    let concentrationLevel: "high" | "medium" | "low" | "none" = "none";
    if (isPointInPlume(zone.lng, zone.lat, source, bearingRad, distances.high, spreadAngle.high)) {
      concentrationLevel = "high";
    } else if (isPointInPlume(zone.lng, zone.lat, source, bearingRad, distances.medium, spreadAngle.medium)) {
      concentrationLevel = "medium";
    } else if (isPointInPlume(zone.lng, zone.lat, source, bearingRad, distances.low, spreadAngle.low)) {
      concentrationLevel = "low";
    }

    return {
      name: zone.name,
      distanceKm: Math.round(distKm * 10) / 10,
      etaMinutes: concentrationLevel !== "none" ? etaMinutes : -1,
      concentrationLevel,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);

  const affected = affectedZones.filter((z) => z.concentrationLevel !== "none");
  const summary = affected.length > 0
    ? `Simulacion de ${params.label.toLowerCase()} con viento de ${windSpeed} km/h. Zonas potencialmente afectadas: ${affected.map((z) => `${z.name} (${z.etaMinutes} min)`).join(", ")}.`
    : `Simulacion de ${params.label.toLowerCase()} con viento de ${windSpeed} km/h. Segun las condiciones actuales, la dispersion no alcanza zonas residenciales en ${durationMinutes} minutos.`;

  return {
    plumes,
    windBearing: plumeBearing,
    affectedZones,
    summary,
  };
}

/** Generate a cone-shaped plume polygon */
function generatePlumePolygon(
  source: [number, number],
  bearingRad: number,
  distKm: number,
  spreadAngleDeg: number
): [number, number][] {
  const points: [number, number][] = [];
  const spreadRad = (spreadAngleDeg * Math.PI) / 180;

  // Start at source
  points.push(source);

  // Generate arc at the far end
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const angle = bearingRad - spreadRad + (2 * spreadRad * i) / steps;
    const point = offsetPoint(source, angle, distKm);
    points.push(point);
  }

  // Close polygon
  points.push(source);
  return points;
}

/** Check if a point falls within a plume cone */
function isPointInPlume(
  lng: number, lat: number,
  source: [number, number],
  bearingRad: number,
  distKm: number,
  spreadAngleDeg: number
): boolean {
  const pointDist = haversineKm(source[1], source[0], lat, lng);
  if (pointDist > distKm) return false;

  const pointBearing = Math.atan2(
    (lng - source[0]) * Math.cos((lat * Math.PI) / 180),
    lat - source[1]
  );

  let angleDiff = Math.abs(pointBearing - bearingRad);
  if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

  return angleDiff <= (spreadAngleDeg * Math.PI) / 180;
}

/** Offset a point by distance and bearing */
function offsetPoint(origin: [number, number], bearingRad: number, distKm: number): [number, number] {
  const latRad = (origin[1] * Math.PI) / 180;
  const dLat = (distKm / 111.32) * Math.cos(bearingRad);
  const dLng = (distKm / (111.32 * Math.cos(latRad))) * Math.sin(bearingRad);
  return [origin[0] + dLng, origin[1] + dLat];
}

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
