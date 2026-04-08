"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { saveField, polygonToBbox, polygonArea, generateFieldId } from "@/lib/fields";
import type { Field } from "@/lib/fields";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface FieldDrawMapProps {
  onFieldCreated: (field: Field) => void;
}

export function FieldDrawMap({ onFieldCreated }: FieldDrawMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [polygon, setPolygon] = useState<[number, number][] | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-62.27, -38.72],
      zoom: 10,
      attributionControl: false,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "draw_polygon",
    });

    map.addControl(draw, "top-left");
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("draw.create", (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0];
      if (feature.geometry.type === "Polygon") {
        const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
        setPolygon(coords);
      }
    });

    map.on("draw.delete", () => setPolygon(null));
    map.on("draw.update", (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0];
      if (feature.geometry.type === "Polygon") {
        const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
        setPolygon(coords);
      }
    });

    mapRef.current = map;
    drawRef.current = draw;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const handleSave = useCallback(() => {
    if (!polygon || !name.trim()) return;
    setSaving(true);

    const bbox = polygonToBbox(polygon);
    const area = polygonArea(polygon);

    const field: Field = {
      id: generateFieldId(),
      name: name.trim(),
      location: location.trim() || "Sin ubicacion",
      polygon,
      bbox,
      area,
      createdAt: new Date().toISOString(),
    };

    saveField(field);
    onFieldCreated(field);
  }, [polygon, name, location, onFieldCreated]);

  const area = polygon ? polygonArea(polygon) : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-earth-deep" style={{ minHeight: 500 }}>
        <div ref={containerRef} className="w-full h-full" style={{ minHeight: 500 }} />
      </div>

      {/* Form sidebar */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="rounded-xl border border-earth-deep bg-white/60 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Datos del campo</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Nombre del campo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Campo Rodriguez, Lote 4"
                className="w-full rounded-lg border border-earth-deep bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-warm/50 focus:border-teal focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Localidad
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Trenque Lauquen"
                className="w-full rounded-lg border border-earth-deep bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-warm/50 focus:border-teal focus:outline-none"
              />
            </div>
          </div>

          {/* Polygon status */}
          <div className="mt-4 pt-4 border-t border-earth-deep/50">
            {polygon ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-air-good" />
                  <span className="text-xs text-ink-muted">Perimetro dibujado</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-warm">Superficie</span>
                  <span className="font-mono text-ink">{area.toFixed(0)} ha</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-warm">Vertices</span>
                  <span className="font-mono text-ink">{polygon.length - 1}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-slate-warm/40 animate-pulse" />
                <span className="text-xs text-slate-warm">
                  Dibuja el perimetro del campo en el mapa
                </span>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!polygon || !name.trim() || saving}
            className="mt-4 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-earth transition-all hover:bg-ink-light active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando..." : "Guardar campo"}
          </button>
        </div>

        <p className="text-[10px] text-slate-warm/60 mt-3 px-1">
          Usa la herramienta de poligono en el mapa para dibujar el perimetro.
          Sentinel-2 lo analiza automaticamente cada 5 dias.
        </p>
      </div>
    </div>
  );
}
