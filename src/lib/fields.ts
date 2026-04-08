/**
 * Field storage — localStorage for validation, Supabase later.
 *
 * A "field" is a named polygon that an agronomist monitors.
 */

export interface Field {
  id: string;
  name: string;
  location: string; // e.g. "Trenque Lauquen"
  polygon: [number, number][]; // [lng, lat] pairs forming the polygon
  bbox: [number, number, number, number]; // [west, south, east, north]
  area: number; // hectares (approx)
  createdAt: string;
}

export interface FieldAnalysis {
  fieldId: string;
  date: string;
  ndviMean: number;
  ndviPrev: number | null;
  ndviChange: number | null; // percentage change
  status: "ok" | "warning" | "alert";
  precipitation7d: number | null; // mm in last 7 days
  interpretation: string | null;
}

const STORAGE_KEY = "monitorbb-fields";

export function getFields(): Field[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveField(field: Field): void {
  const fields = getFields();
  fields.push(field);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
}

export function deleteField(id: string): void {
  const fields = getFields().filter((f) => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fields));
}

export function getField(id: string): Field | undefined {
  return getFields().find((f) => f.id === id);
}

/** Calculate bounding box from polygon coordinates */
export function polygonToBbox(coords: [number, number][]): [number, number, number, number] {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

/** Approximate area in hectares from a polygon using the shoelace formula */
export function polygonArea(coords: [number, number][]): number {
  // Convert to approximate meters using latitude
  const avgLat = coords.reduce((s, [, lat]) => s + lat, 0) / coords.length;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((avgLat * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const xi = coords[i][0] * mPerDegLng;
    const yi = coords[i][1] * mPerDegLat;
    const xj = coords[j][0] * mPerDegLng;
    const yj = coords[j][1] * mPerDegLat;
    area += xi * yj - xj * yi;
  }
  // m² to hectares
  return Math.abs(area / 2) / 10000;
}

export function generateFieldId(): string {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
