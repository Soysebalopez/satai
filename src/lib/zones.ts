/**
 * Bahía Blanca monitoring zones — each with its own coordinates
 * for querying per-zone atmospheric data.
 */

export interface Zone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description: string;
  type: "industrial" | "residential" | "coastal";
}

export const ZONES: Zone[] = [
  {
    id: "ingeniero-white",
    name: "Ingeniero White",
    lat: -38.7826,
    lng: -62.2614,
    description: "Polo petroquimico y puerto",
    type: "industrial",
  },
  {
    id: "centro",
    name: "Centro",
    lat: -38.7196,
    lng: -62.2724,
    description: "Area urbana central",
    type: "residential",
  },
  {
    id: "villa-mitre",
    name: "Villa Mitre",
    lat: -38.7050,
    lng: -62.2900,
    description: "Zona residencial noroeste",
    type: "residential",
  },
  {
    id: "barrio-noroeste",
    name: "Barrio Noroeste",
    lat: -38.6950,
    lng: -62.2800,
    description: "Zona residencial norte",
    type: "residential",
  },
  {
    id: "grunbein",
    name: "Grunbein",
    lat: -38.7600,
    lng: -62.3100,
    description: "Zona sur, cercana al polo",
    type: "residential",
  },
  {
    id: "bahia",
    name: "Estuario de la Bahia",
    lat: -38.8000,
    lng: -62.2400,
    description: "Zona costera y humedales",
    type: "coastal",
  },
];

export function getZone(id: string): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}
