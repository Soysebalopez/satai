"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { BAHIA_BLANCA } from "@/lib/constants";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface WindData {
  current: {
    windSpeed: number;
    windDirection: number;
    windDirectionLabelEs: string;
    temperature: number;
    humidity: number;
  };
  dispersion: {
    description: string;
    affectedAreas: string[];
    intensity: string;
  };
}

interface FirePoint {
  latitude: number;
  longitude: number;
  brightness: number;
  confidence: string;
  frp: number;
}

interface FiresData {
  fires: FirePoint[];
  count: number;
  summary: { level: string; description: string };
}

interface AirData {
  summary: Record<string, { value: number; unit: string }>;
  source: string;
}

export function MapContainer() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [wind, setWind] = useState<WindData | null>(null);
  const [fires, setFires] = useState<FiresData | null>(null);
  const [air, setAir] = useState<AirData | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch all data
  useEffect(() => {
    async function fetchData() {
      const [windRes, firesRes, airRes] = await Promise.all([
        fetch("/api/wind").then((r) => r.json()).catch(() => null),
        fetch("/api/fires").then((r) => r.json()).catch(() => null),
        fetch("/api/air-quality").then((r) => r.json()).catch(() => null),
      ]);
      setWind(windRes);
      setFires(firesRes);
      setAir(airRes);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [BAHIA_BLANCA.center.lng, BAHIA_BLANCA.center.lat],
      zoom: BAHIA_BLANCA.zoom,
      pitch: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");

    // Mark petrochemical hub
    new mapboxgl.Marker({ color: "#6b7280", scale: 0.7 })
      .setLngLat([-62.2614, -38.7826])
      .setPopup(new mapboxgl.Popup().setHTML("<strong>Polo Petroquimico</strong><br/>Ingeniero White"))
      .addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add fire markers when data arrives
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fires?.fires.length) return;

    for (const fire of fires.fires) {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#f97316";
      el.style.border = "2px solid #ea580c";
      el.style.boxShadow = "0 0 8px rgba(249,115,22,0.5)";

      new mapboxgl.Marker({ element: el })
        .setLngLat([fire.longitude, fire.latitude])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>Foco de calor</strong><br/>Confianza: ${fire.confidence}<br/>FRP: ${fire.frp} MW`
          )
        )
        .addTo(map);
    }
  }, [fires]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />

      {/* Data overlay panel */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 max-w-xs">
        {/* Air quality card */}
        <div className="rounded-xl border border-earth-deep bg-white/90 backdrop-blur-sm p-4 shadow-sm">
          <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted mb-2">
            Calidad del aire
          </p>
          {loading ? (
            <div className="h-4 w-32 rounded bg-earth-deep/30 animate-pulse" />
          ) : air?.summary ? (
            <div className="space-y-1">
              {Object.entries(air.summary).slice(0, 4).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-ink-muted">{key}</span>
                  <span className="font-mono text-ink-light">
                    {val.value} <span className="text-slate-warm">{val.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-warm">Sin datos disponibles</p>
          )}
        </div>

        {/* Wind card */}
        <div className="rounded-xl border border-earth-deep bg-white/90 backdrop-blur-sm p-4 shadow-sm">
          <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted mb-2">
            Viento
          </p>
          {loading ? (
            <div className="h-4 w-32 rounded bg-earth-deep/30 animate-pulse" />
          ) : wind?.current ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-teal"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ transform: `rotate(${wind.current.windDirection + 180}deg)` }}
                >
                  <path d="M12 2l0 20M12 2l-4 4M12 2l4 4" />
                </svg>
                <span className="text-sm font-medium text-ink">
                  {wind.current.windSpeed} km/h
                </span>
                <span className="text-xs text-slate-warm">
                  {wind.current.windDirectionLabelEs}
                </span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {wind.dispersion.description}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-warm">Sin datos disponibles</p>
          )}
        </div>

        {/* Fires card */}
        {fires && fires.count > 0 && (
          <div className="rounded-xl border border-air-bad/30 bg-white/90 backdrop-blur-sm p-4 shadow-sm">
            <p className="text-[10px] font-mono tracking-wider uppercase text-air-bad mb-2">
              Incendios activos
            </p>
            <p className="text-xs text-ink-muted">
              {fires.summary.description}
            </p>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-earth/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
            <span className="text-xs font-mono text-ink-muted">
              Cargando datos satelitales...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
