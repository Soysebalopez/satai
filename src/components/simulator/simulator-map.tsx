"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { Crosshair, Play, Spinner, Warning } from "@phosphor-icons/react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type EventType = "fuga_gas" | "incendio_industrial" | "derrame";

interface SimResult {
  input: {
    source: [number, number];
    eventType: string;
    durationMinutes: number;
    wind: { direction: number; speed: number; gusts: number };
  };
  result: {
    plumes: Array<{
      level: string;
      label: string;
      color: string;
      opacity: number;
      polygon: [number, number][];
      reachesZones: string[];
      etaMinutes: number;
    }>;
    windBearing: number;
    affectedZones: Array<{
      name: string;
      distanceKm: number;
      etaMinutes: number;
      concentrationLevel: string;
    }>;
    summary: string;
  };
  interpretation: string | null;
}

const EVENT_OPTIONS: Array<{ key: EventType; label: string }> = [
  { key: "fuga_gas", label: "Fuga de gas" },
  { key: "incendio_industrial", label: "Incendio industrial" },
  { key: "derrame", label: "Derrame" },
];

const DURATION_OPTIONS = [15, 30, 60, 120];

const LEVEL_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#eab308",
  none: "#9ca3af",
};

export function SimulatorMap() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [source, setSource] = useState<[number, number] | null>(null);
  const [eventType, setEventType] = useState<EventType>("fuga_gas");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-62.27, -38.74],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Click to place source point
    map.on("click", (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setSource(lngLat);

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLngLat(lngLat);
      } else {
        markerRef.current = new mapboxgl.Marker({ color: "#ef4444", scale: 0.8 })
          .setLngLat(lngLat)
          .addTo(map);
      }

      // Clear previous plumes
      clearPlumes(map);
      setResult(null);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Draw plumes on map when result changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !result) return;

    clearPlumes(map);

    const addLayers = () => {
      // Add plume layers (low first so high renders on top)
      const reversed = [...result.result.plumes].reverse();
      reversed.forEach((plume, i) => {
        const sourceId = `plume-source-${i}`;
        const layerId = `plume-layer-${i}`;

        if (map.getSource(sourceId)) return;

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [plume.polygon] },
          },
        });

        map.addLayer({
          id: layerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": plume.color,
            "fill-opacity": plume.opacity,
          },
        });

        map.addLayer({
          id: `${layerId}-outline`,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": plume.color,
            "line-width": 1,
            "line-opacity": plume.opacity + 0.2,
            "line-dasharray": [2, 2],
          },
        });
      });
    };

    if (map.isStyleLoaded()) addLayers();
    else map.once("style.load", addLayers);
  }, [result]);

  function clearPlumes(map: mapboxgl.Map) {
    for (let i = 0; i < 3; i++) {
      if (map.getLayer(`plume-layer-${i}-outline`)) map.removeLayer(`plume-layer-${i}-outline`);
      if (map.getLayer(`plume-layer-${i}`)) map.removeLayer(`plume-layer-${i}`);
      if (map.getSource(`plume-source-${i}`)) map.removeSource(`plume-source-${i}`);
    }
  }

  const handleSimulate = useCallback(async () => {
    if (!source) return;
    setLoading(true);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, eventType, durationMinutes: duration }),
      });
      const data = await res.json();
      setResult(data);
    } catch {}

    setLoading(false);
  }, [source, eventType, duration]);

  const affected = result?.result.affectedZones.filter((z) => z.concentrationLevel !== "none") || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-earth-deep" style={{ minHeight: 500 }}>
          <div ref={containerRef} className="w-full h-full" style={{ minHeight: 500 }} />
        </div>

        {/* Controls */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <div className="rounded-xl border border-earth-deep bg-white/60 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Parametros</h3>

            {/* Source status */}
            <div className="mb-4">
              {source ? (
                <div className="flex items-center gap-2 text-xs">
                  <Crosshair className="w-3.5 h-3.5 text-air-dangerous" weight="duotone" />
                  <span className="font-mono text-ink">
                    {source[1].toFixed(4)}, {source[0].toFixed(4)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-warm flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 animate-pulse" weight="regular" />
                  Click en el mapa para marcar el origen
                </p>
              )}
            </div>

            {/* Event type */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Tipo de evento</label>
              <div className="space-y-1">
                {EVENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setEventType(opt.key)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-[0.98] ${
                      eventType === opt.key
                        ? "bg-ink text-earth"
                        : "bg-earth-mid text-ink-muted hover:bg-earth-deep/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-ink-muted mb-1.5">
                Duracion (minutos)
              </label>
              <div className="flex gap-1">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all active:scale-[0.97] ${
                      duration === d
                        ? "bg-ink text-earth"
                        : "bg-earth-mid text-ink-muted hover:bg-earth-deep/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSimulate}
              disabled={!source || loading}
              className="w-full rounded-xl bg-air-dangerous px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-air-dangerous/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Spinner className="w-4 h-4 animate-spin" /> Simulando...</>
              ) : (
                <><Play className="w-4 h-4" weight="fill" /> Simular dispersion</>
              )}
            </button>
          </div>

          {/* Wind info */}
          {result && (
            <div className="rounded-xl border border-earth-deep bg-white/60 p-4">
              <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted mb-2">
                Condiciones de viento
              </p>
              <div className="flex items-center gap-3 text-xs">
                <svg className="w-5 h-5 text-[#3b82f6]" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  style={{ transform: `rotate(${result.input.wind.direction + 180}deg)` }}>
                  <path d="M12 2l0 20M12 2l-4 4M12 2l4 4" />
                </svg>
                <span className="font-medium text-ink">{result.input.wind.speed} km/h</span>
                <span className="text-slate-warm">Rafagas: {result.input.wind.gusts} km/h</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Alert banner */}
          <div className="rounded-xl border border-air-dangerous/20 bg-air-dangerous/5 p-5">
            <div className="flex items-start gap-3">
              <Warning className="w-5 h-5 text-air-dangerous shrink-0 mt-0.5" weight="duotone" />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-air-dangerous mb-1">
                  Simulacion — No es un evento real
                </p>
                <p className="text-sm text-ink leading-relaxed">
                  {result.interpretation || result.result.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Affected zones table */}
          <div className="rounded-xl border border-earth-deep bg-white/60 p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">Impacto por zona</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-[10px] font-mono uppercase tracking-wider text-slate-warm pb-2 border-b border-earth-deep/30">
                <span>Zona</span>
                <span className="text-right">Distancia</span>
                <span className="text-right">ETA</span>
                <span className="text-right">Nivel</span>
              </div>
              {result.result.affectedZones.map((zone) => (
                <div key={zone.name} className="grid grid-cols-4 text-xs py-1.5">
                  <span className="text-ink font-medium">{zone.name}</span>
                  <span className="text-right font-mono text-ink-muted">{zone.distanceKm} km</span>
                  <span className="text-right font-mono text-ink-muted">
                    {zone.etaMinutes > 0 ? `${zone.etaMinutes} min` : "—"}
                  </span>
                  <span className="text-right">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: LEVEL_COLORS[zone.concentrationLevel] + "15",
                        color: LEVEL_COLORS[zone.concentrationLevel],
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: LEVEL_COLORS[zone.concentrationLevel] }}
                      />
                      {zone.concentrationLevel === "none" ? "No afectada" : zone.concentrationLevel}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Plume legend */}
          <div className="flex items-center gap-4 text-[10px] text-slate-warm">
            {result.result.plumes.map((p) => (
              <div key={p.level} className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: p.color, opacity: p.opacity + 0.3 }} />
                <span>{p.label} (~{p.etaMinutes} min)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
