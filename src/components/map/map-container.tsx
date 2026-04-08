"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { BAHIA_BLANCA, getAirLevel, AIR_LEVEL_COLORS } from "@/lib/constants";
import { LayerToggles, type LayerKey } from "./layer-toggles";

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

const WIND_GRID_POINTS = [
  { lat: -38.70, lng: -62.30 }, { lat: -38.70, lng: -62.25 }, { lat: -38.70, lng: -62.20 },
  { lat: -38.72, lng: -62.32 }, { lat: -38.72, lng: -62.27 }, { lat: -38.72, lng: -62.22 },
  { lat: -38.74, lng: -62.30 }, { lat: -38.74, lng: -62.25 }, { lat: -38.74, lng: -62.20 },
  { lat: -38.76, lng: -62.28 }, { lat: -38.76, lng: -62.24 },
];

function createWindArrowSvg(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "#3b82f6");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute("d", "M12 2l0 20");
  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M12 2l-5 5");
  const path3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path3.setAttribute("d", "M12 2l5 5");
  svg.append(path1, path2, path3);
  return svg;
}

export function MapContainer() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [wind, setWind] = useState<WindData | null>(null);
  const [fires, setFires] = useState<FiresData | null>(null);
  const [air, setAir] = useState<AirData | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [satInterpretation, setSatInterpretation] = useState<string | null>(null);
  const [satLoading, setSatLoading] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    air: true, wind: true, fires: true,
    satellite: false, ndvi: false, moisture: false,
  });

  const toggleLayer = useCallback((key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

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

      fetch("/api/summary")
        .then((r) => r.json())
        .then((data) => { if (data.summary) setAiSummary(data.summary); })
        .catch(() => {});
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

    // Petrochemical hub
    const hubPopup = new mapboxgl.Popup({ offset: 12 });
    hubPopup.setHTML("<strong>Polo Petroquimico</strong><br/><span style='font-size:11px;color:#6b7280'>Ingeniero White</span>");
    new mapboxgl.Marker({ color: "#6b7280", scale: 0.7 })
      .setLngLat([-62.2614, -38.7826])
      .setPopup(hubPopup)
      .addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Clear markers for a given layer
  function clearLayerMarkers(layerName: string) {
    const toRemove = markersRef.current.filter((m) => m.getElement().dataset.layer === layerName);
    toRemove.forEach((m) => m.remove());
    markersRef.current = markersRef.current.filter((m) => m.getElement().dataset.layer !== layerName);
  }

  // Wind arrows layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !wind?.current) return;
    clearLayerMarkers("wind");
    if (!layers.wind) return;

    const dir = wind.current.windDirection;
    const speed = wind.current.windSpeed;
    const arrowSize = Math.min(32, Math.max(18, speed * 1.2));

    for (const point of WIND_GRID_POINTS) {
      const el = document.createElement("div");
      el.dataset.layer = "wind";
      el.style.width = `${arrowSize}px`;
      el.style.height = `${arrowSize}px`;
      el.style.transform = `rotate(${dir}deg)`;
      el.style.opacity = "0.55";
      el.appendChild(createWindArrowSvg());

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [wind, layers.wind]);

  // Fire markers layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clearLayerMarkers("fires");
    if (!layers.fires || !fires?.fires.length) return;

    for (const fire of fires.fires) {
      const el = document.createElement("div");
      el.dataset.layer = "fires";
      Object.assign(el.style, {
        width: "14px", height: "14px", borderRadius: "50%",
        backgroundColor: "#f97316", border: "2px solid #ea580c",
        boxShadow: "0 0 10px rgba(249,115,22,0.6)",
        animation: "semaphore-pulse 2s ease-in-out infinite",
      });

      const popup = new mapboxgl.Popup({ offset: 12 });
      const popupEl = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = "Foco de calor";
      const detail = document.createElement("span");
      detail.style.fontSize = "11px";
      detail.style.color = "#6b7280";
      detail.textContent = `Confianza: ${fire.confidence} — FRP: ${fire.frp} MW`;
      popupEl.append(title, document.createElement("br"), detail);
      popup.setDOMContent(popupEl);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([fire.longitude, fire.latitude])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [fires, layers.fires]);

  // Air quality zones layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clearLayerMarkers("air");
    if (!layers.air || !air?.summary) return;

    let worstColor = AIR_LEVEL_COLORS.good;
    const pollutants = ["NO2", "SO2", "PM25", "O3"] as const;
    const levelPriority = ["dangerous", "bad", "moderate", "good"] as const;
    let worstIdx = 3;

    for (const p of pollutants) {
      if (air.summary[p]) {
        const lvl = getAirLevel(p, air.summary[p].value);
        const idx = levelPriority.indexOf(lvl);
        if (idx < worstIdx) {
          worstIdx = idx;
          worstColor = AIR_LEVEL_COLORS[lvl];
        }
      }
    }

    const zones = [
      { lat: -38.7826, lng: -62.2614, size: 80, label: "Ingeniero White" },
      { lat: -38.7196, lng: -62.2724, size: 60, label: "Centro" },
      { lat: -38.7050, lng: -62.2900, size: 50, label: "Villa Mitre" },
    ];

    for (const zone of zones) {
      const el = document.createElement("div");
      el.dataset.layer = "air";
      Object.assign(el.style, {
        width: `${zone.size}px`, height: `${zone.size}px`, borderRadius: "50%",
        backgroundColor: worstColor + "25", border: `2px solid ${worstColor}50`,
        transition: "opacity 0.3s",
      });

      const popup = new mapboxgl.Popup({ offset: 12 });
      const popupEl = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = zone.label;
      const status = document.createElement("span");
      status.style.cssText = `font-size:11px;color:${worstColor};font-weight:600;display:block`;
      status.textContent = levelPriority[worstIdx].toUpperCase();
      popupEl.append(title, document.createElement("br"), status);
      popup.setDOMContent(popupEl);

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([zone.lng, zone.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [air, layers.air]);

  // Satellite image overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Determine which satellite layer is active (only one at a time)
    const activeSatLayer = (["satellite", "ndvi", "moisture"] as const).find((k) => layers[k]);
    const layerMap = { satellite: "trueColor", ndvi: "ndvi", moisture: "moisture" } as const;

    // Remove existing satellite source/layer
    if (map.getLayer("sentinel-overlay")) map.removeLayer("sentinel-overlay");
    if (map.getSource("sentinel-source")) map.removeSource("sentinel-source");
    setSatInterpretation(null);

    if (!activeSatLayer) return;

    const apiLayer = layerMap[activeSatLayer];
    const imageUrl = `/api/satellite?layer=${apiLayer}&t=${Date.now()}`;
    const bounds = BAHIA_BLANCA.bounds;

    setSatLoading(true);

    // Wait for map style to be loaded
    const addLayer = () => {
      if (map.getSource("sentinel-source")) return;
      map.addSource("sentinel-source", {
        type: "image",
        url: imageUrl,
        coordinates: [
          [bounds.west, bounds.north],
          [bounds.east, bounds.north],
          [bounds.east, bounds.south],
          [bounds.west, bounds.south],
        ],
      });
      map.addLayer({
        id: "sentinel-overlay",
        type: "raster",
        source: "sentinel-source",
        paint: { "raster-opacity": 0.75 },
      });
      setSatLoading(false);

      // Fetch interpretation
      fetch(`/api/satellite/interpret?layer=${apiLayer}`)
        .then((r) => r.json())
        .then((data) => { if (data.interpretation) setSatInterpretation(data.interpretation); })
        .catch(() => {});
    };

    if (map.isStyleLoaded()) {
      addLayer();
    } else {
      map.once("style.load", addLayer);
    }
  }, [layers.satellite, layers.ndvi, layers.moisture]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="w-full h-full" />

      {/* Layer toggles */}
      <div className="absolute top-4 right-14 z-10">
        <LayerToggles active={layers} onToggle={toggleLayer} />
      </div>

      {/* Data panel */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 max-w-xs">
        {/* AI Summary */}
        <div className="rounded-xl border border-earth-deep bg-white/90 backdrop-blur-sm p-4 shadow-sm">
          <p className="text-[10px] font-mono tracking-wider uppercase text-teal-deep mb-2">
            Resumen ciudadano
          </p>
          {aiSummary ? (
            <p className="text-xs text-ink-light leading-relaxed">{aiSummary}</p>
          ) : (
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-earth-deep/20 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-earth-deep/20 animate-pulse" />
            </div>
          )}
        </div>

        {/* Satellite interpretation */}
        {(layers.satellite || layers.ndvi || layers.moisture) && (
          <div className="rounded-xl border border-ink/10 bg-white/90 backdrop-blur-sm p-4 shadow-sm">
            <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted mb-2">
              {layers.satellite ? "Imagen satelital" : layers.ndvi ? "Vegetacion (NDVI)" : "Humedad del suelo"}
            </p>
            {satLoading ? (
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-earth-deep/20 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-earth-deep/20 animate-pulse" />
              </div>
            ) : satInterpretation ? (
              <p className="text-xs text-ink-light leading-relaxed">{satInterpretation}</p>
            ) : (
              <p className="text-xs text-slate-warm italic">Cargando imagen Sentinel-2...</p>
            )}
            <p className="text-[9px] text-slate-warm/60 mt-2 font-mono">Sentinel-2 L2A / ESA Copernicus</p>
          </div>
        )}

        {/* Air quality */}
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

        {/* Wind */}
        <div className="rounded-xl border border-earth-deep bg-white/90 backdrop-blur-sm p-4 shadow-sm">
          <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted mb-2">
            Viento
          </p>
          {loading ? (
            <div className="h-4 w-32 rounded bg-earth-deep/30 animate-pulse" />
          ) : wind?.current ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#3b82f6]" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  style={{ transform: `rotate(${wind.current.windDirection + 180}deg)` }}>
                  <path d="M12 2l0 20M12 2l-4 4M12 2l4 4" />
                </svg>
                <span className="text-sm font-medium text-ink">{wind.current.windSpeed} km/h</span>
                <span className="text-xs text-slate-warm">{wind.current.windDirectionLabelEs}</span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">{wind.dispersion.description}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-warm">Sin datos disponibles</p>
          )}
        </div>

        {/* Fires */}
        {fires && fires.count > 0 && (
          <div className="rounded-xl border border-air-bad/30 bg-white/90 backdrop-blur-sm p-4 shadow-sm">
            <p className="text-[10px] font-mono tracking-wider uppercase text-air-bad mb-2">
              Incendios activos
            </p>
            <p className="text-xs text-ink-muted">{fires.summary.description}</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-earth/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
            <span className="text-xs font-mono text-ink-muted">Cargando datos satelitales...</span>
          </div>
        </div>
      )}
    </div>
  );
}
