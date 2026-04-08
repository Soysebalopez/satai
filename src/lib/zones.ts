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
    description: "Zona residencial norte",
    type: "residential",
  },
  {
    id: "noroeste",
    name: "Noroeste",
    lat: -38.7350,
    lng: -62.3050,
    description: "Zona residencial suroeste",
    type: "residential",
  },
  {
    id: "palihue",
    name: "Palihue",
    lat: -38.7250,
    lng: -62.2450,
    description: "Zona residencial este",
    type: "residential",
  },
  {
    id: "villa-floresta",
    name: "Villa Floresta",
    lat: -38.7350,
    lng: -62.3200,
    description: "Zona residencial oeste, cercana al polo",
    type: "residential",
  },
  {
    id: "grumbein",
    name: "Grünbein",
    lat: -38.7550,
    lng: -62.2950,
    description: "Zona sur, cercana al polo",
    type: "residential",
  },
  {
    id: "universitario",
    name: "Universitario",
    lat: -38.7100,
    lng: -62.2500,
    description: "Zona universidad y campus",
    type: "residential",
  },
];

export function getZone(id: string): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}
