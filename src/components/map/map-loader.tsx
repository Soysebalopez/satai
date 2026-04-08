"use client";

import dynamic from "next/dynamic";

const MapContainer = dynamic(
  () => import("@/components/map/map-container").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-earth">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-ink-muted">Cargando mapa...</span>
        </div>
      </div>
    ),
  }
);

export function MapLoader() {
  return <MapContainer />;
}
