"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { polygonToBbox, polygonArea } from "@/lib/fields";
import { Warning, CheckCircle, XCircle, Spinner } from "@phosphor-icons/react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type EventType = "granizo" | "sequia" | "inundacion" | "helada";

interface VerifyResult {
  verification: { fieldName: string; eventType: string; eventDate: string; dataSource: string; verifiedAt: string };
  before: { period: { from: string; to: string }; ndviMean: number | null; imageUrl: string };
  after: { period: { from: string; to: string }; ndviMean: number | null; imageUrl: string };
  damage: {
    ndviChange: number | null;
    damagePercent: number | null;
    affectedHa: number | null;
    totalHa: number;
    severity: string;
    consistent: boolean | null;
  };
  summary: string;
  disclaimer: string;
}

const EVENT_LABELS: Record<EventType, string> = {
  granizo: "Granizo",
  sequia: "Sequia",
  inundacion: "Inundacion",
  helada: "Helada",
};

const SEVERITY_CONFIG: Record<string, { color: string; icon: typeof Warning }> = {
  ninguno: { color: "#22c55e", icon: CheckCircle },
  leve: { color: "#eab308", icon: Warning },
  moderado: { color: "#f97316", icon: Warning },
  severo: { color: "#ef4444", icon: XCircle },
  total: { color: "#ef4444", icon: XCircle },
  indeterminado: { color: "#9ca3af", icon: Warning },
};

export function VerifyForm() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const [areaHa, setAreaHa] = useState(0);
  const [fieldName, setFieldName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<EventType>("sequia");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-62.27, -38.72],
      zoom: 9,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: "simple_select",
      });
      map.addControl(draw, "top-left");

      map.on("draw.create", (e: { features: GeoJSON.Feature[] }) => {
        const feature = e.features[0];
        if (feature.geometry.type === "Polygon") {
          const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
          setBbox(polygonToBbox(coords));
          setAreaHa(polygonArea(coords));
        }
      });
      map.on("draw.delete", () => { setBbox(null); setAreaHa(0); });
      map.on("draw.update", (e: { features: GeoJSON.Feature[] }) => {
        const feature = e.features[0];
        if (feature.geometry.type === "Polygon") {
          const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0] as [number, number][];
          setBbox(polygonToBbox(coords));
          setAreaHa(polygonArea(coords));
        }
      });
    });

    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  const handleVerify = useCallback(async () => {
    if (!bbox || !eventDate) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/seguros/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bbox,
          eventDate,
          eventType,
          fieldName: fieldName.trim() || "Campo sin nombre",
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      // error handled by empty result
    }
    setLoading(false);
  }, [bbox, eventDate, eventType, fieldName]);

  const severityConfig = result?.damage.severity
    ? SEVERITY_CONFIG[result.damage.severity] || SEVERITY_CONFIG.indeterminado
    : null;
  const SeverityIcon = severityConfig?.icon || Warning;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-earth-deep" style={{ minHeight: 450 }}>
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: 450 }} />
        </div>

        {/* Form */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          <div className="rounded-xl border border-earth-deep bg-white/60 backdrop-blur-sm p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Datos del siniestro</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Nombre del campo
                </label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="Ej: Campo Rodriguez, Lote 4"
                  className="w-full rounded-lg border border-earth-deep bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-warm/50 focus:border-teal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Fecha del evento
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-lg border border-earth-deep bg-white px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Tipo de evento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(EVENT_LABELS) as [EventType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setEventType(key)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all active:scale-[0.97] ${
                        eventType === key
                          ? "bg-ink text-earth"
                          : "bg-earth-mid text-ink-muted hover:bg-earth-deep/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Polygon status */}
            <div className="mt-4 pt-4 border-t border-earth-deep/50">
              {bbox ? (
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-air-good" />
                    <span className="text-ink-muted">Perimetro dibujado</span>
                  </div>
                  <span className="font-mono text-ink">{areaHa.toFixed(0)} ha</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-slate-warm/40 animate-pulse" />
                  <span className="text-xs text-slate-warm">Dibuja el campo en el mapa</span>
                </div>
              )}
            </div>

            <button
              onClick={handleVerify}
              disabled={!bbox || !eventDate || loading}
              className="mt-4 w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-earth transition-all hover:bg-ink-light active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner className="w-4 h-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar siniestro"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && result.damage && (
        <div className="space-y-4">
          {/* Verdict */}
          <div
            className="rounded-xl border p-6"
            style={{
              borderColor: severityConfig?.color + "30",
              backgroundColor: severityConfig?.color + "06",
            }}
          >
            <div className="flex items-start gap-4">
              <SeverityIcon
                className="w-8 h-8 shrink-0 mt-0.5"
                weight="duotone"
                style={{ color: severityConfig?.color }}
              />
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-ink">
                    Severidad: {result.damage.severity.charAt(0).toUpperCase() + result.damage.severity.slice(1)}
                  </h3>
                  {result.damage.consistent !== null && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: result.damage.consistent ? "#f9731620" : "#22c55e20",
                        color: result.damage.consistent ? "#f97316" : "#22c55e",
                      }}
                    >
                      {result.damage.consistent ? "Consistente con evento" : "No consistente"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-light leading-relaxed">{result.summary}</p>
              </div>
            </div>
          </div>

          {/* Before / After comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before */}
            <div className="rounded-xl border border-earth-deep bg-white/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted">
                  Pre-evento
                </p>
                <span className="text-[10px] text-slate-warm">
                  {result.before.period.from} a {result.before.period.to}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.before.imageUrl}
                alt="NDVI pre-evento"
                className="w-full rounded-lg border border-earth-deep/50"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-ink-muted">NDVI promedio</span>
                <span className="text-lg font-semibold font-mono text-ink">
                  {result.before.ndviMean?.toFixed(3) ?? "—"}
                </span>
              </div>
            </div>

            {/* After */}
            <div className="rounded-xl border border-earth-deep bg-white/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted">
                  Post-evento
                </p>
                <span className="text-[10px] text-slate-warm">
                  {result.after.period.from} a {result.after.period.to}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.after.imageUrl}
                alt="NDVI post-evento"
                className="w-full rounded-lg border border-earth-deep/50"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-ink-muted">NDVI promedio</span>
                <span className="text-lg font-semibold font-mono text-ink">
                  {result.after.ndviMean?.toFixed(3) ?? "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Damage metrics */}
          <div className="rounded-xl border border-earth-deep bg-white/60 p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Metricas de daño</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-[10px] font-mono text-slate-warm mb-1">Cambio NDVI</p>
                <p className="text-xl font-semibold font-mono text-ink">
                  {result.damage.ndviChange !== null
                    ? (result.damage.ndviChange > 0 ? "+" : "") + result.damage.ndviChange.toFixed(3)
                    : "—"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-mono text-slate-warm mb-1">Daño estimado</p>
                <p className="text-xl font-semibold font-mono" style={{ color: severityConfig?.color }}>
                  {result.damage.damagePercent !== null ? `${result.damage.damagePercent}%` : "—"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-mono text-slate-warm mb-1">Area afectada</p>
                <p className="text-xl font-semibold font-mono text-ink">
                  {result.damage.affectedHa !== null ? `${result.damage.affectedHa} ha` : "—"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-mono text-slate-warm mb-1">Area total</p>
                <p className="text-xl font-semibold font-mono text-ink">
                  {result.damage.totalHa} ha
                </p>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-earth-deep/50 bg-earth-mid/30 p-4">
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-warm">
              <span>Fuente: {result.verification.dataSource}</span>
              <span className="text-right">Verificado: {new Date(result.verification.verifiedAt).toLocaleString("es-AR")}</span>
            </div>
            <p className="text-[9px] text-slate-warm/60 mt-2">{result.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
