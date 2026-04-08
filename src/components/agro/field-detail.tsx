"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { getField, deleteField, type Field } from "@/lib/fields";
import { useRouter } from "next/navigation";
import { Trash, MapPin } from "@phosphor-icons/react";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface NDVIPeriod {
  label: string;
  from: string;
  to: string;
  ndviMean: number | null;
  ndviChange: number | null;
  status: "ok" | "warning" | "alert";
}

export function FieldDetail({ fieldId }: { fieldId: string }) {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const [field, setField] = useState<Field | null>(null);
  const [ndviData, setNdviData] = useState<NDVIPeriod[]>([]);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [ndviImageUrl, setNdviImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const f = getField(fieldId);
    if (!f) return;
    setField(f);

    // Fetch NDVI stats
    const bbox = f.bbox.join(",");
    fetch(`/api/agro/ndvi?bbox=${bbox}&weeks=4`)
      .then((r) => r.json())
      .then((data) => {
        setNdviData(data.periods || []);
        setLoading(false);

        // Fetch AI analysis
        const current = data.current;
        if (current) {
          const prev = data.periods?.length > 1 ? data.periods[data.periods.length - 2] : null;
          fetch("/api/agro/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fieldName: f.name,
              location: f.location,
              ndviCurrent: current.ndviMean,
              ndviPrev: prev?.ndviMean ?? null,
              ndviChange: current.ndviChange,
              precipitation7d: null,
              areaHa: f.area,
            }),
          })
            .then((r) => r.json())
            .then((d) => setInterpretation(d.interpretation))
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));

    // Fetch NDVI image
    setNdviImageUrl(`/api/agro/ndvi?bbox=${bbox}&format=image&t=${Date.now()}`);
  }, [fieldId]);

  // Init map showing the field polygon
  useEffect(() => {
    if (!mapRef.current || !field) return;

    const center = [
      (field.bbox[0] + field.bbox[2]) / 2,
      (field.bbox[1] + field.bbox[3]) / 2,
    ] as [number, number];

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center,
      zoom: 14,
      attributionControl: false,
    });

    map.on("load", () => {
      // Add polygon outline
      map.addSource("field-polygon", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [field.polygon],
          },
        },
      });

      map.addLayer({
        id: "field-outline",
        type: "line",
        source: "field-polygon",
        paint: {
          "line-color": "#0d9488",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });

      map.addLayer({
        id: "field-fill",
        type: "fill",
        source: "field-polygon",
        paint: {
          "fill-color": "#0d9488",
          "fill-opacity": 0.1,
        },
      });

      // Add NDVI overlay if available
      if (ndviImageUrl) {
        map.addSource("ndvi-overlay", {
          type: "image",
          url: ndviImageUrl,
          coordinates: [
            [field.bbox[0], field.bbox[3]],
            [field.bbox[2], field.bbox[3]],
            [field.bbox[2], field.bbox[1]],
            [field.bbox[0], field.bbox[1]],
          ],
        });

        map.addLayer(
          {
            id: "ndvi-layer",
            type: "raster",
            source: "ndvi-overlay",
            paint: { "raster-opacity": 0.7 },
          },
          "field-outline"
        );
      }
    });

    return () => map.remove();
  }, [field, ndviImageUrl]);

  const handleDelete = () => {
    if (!field) return;
    deleteField(field.id);
    router.push("/agro");
  };

  if (!field) {
    return <p className="text-ink-muted py-10 text-center">Campo no encontrado</p>;
  }

  const currentNdvi = ndviData.length > 0 ? ndviData[ndviData.length - 1] : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-tighter font-semibold text-ink mb-1">
            {field.name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" weight="fill" />
              {field.location}
            </div>
            <span className="font-mono text-xs">{field.area.toFixed(0)} ha</span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-lg border border-air-dangerous/30 px-3 py-1.5 text-xs font-medium text-air-dangerous hover:bg-air-dangerous/5 transition-colors active:scale-[0.97]"
        >
          <Trash className="w-3.5 h-3.5" weight="bold" />
          Eliminar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
        {/* Map with NDVI overlay */}
        <div
          ref={mapRef}
          className="rounded-xl border border-earth-deep overflow-hidden"
          style={{ minHeight: 400 }}
        />

        {/* Analysis panel */}
        <div className="space-y-4">
          {/* AI interpretation */}
          <div className="rounded-xl border border-earth-deep bg-white/60 p-5">
            <p className="text-[10px] font-mono tracking-wider uppercase text-teal-deep mb-2">
              Analisis IA
            </p>
            {interpretation ? (
              <p className="text-sm text-ink leading-relaxed">{interpretation}</p>
            ) : (
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-earth-deep/20 animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-earth-deep/20 animate-pulse" />
              </div>
            )}
          </div>

          {/* NDVI timeline */}
          <div className="rounded-xl border border-earth-deep bg-white/60 p-5">
            <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted mb-3">
              NDVI — Ultimas {ndviData.length} semanas
            </p>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-6 rounded bg-earth-deep/20 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {ndviData.map((period, i) => {
                  const statusColor =
                    period.status === "alert" ? "#ef4444" :
                    period.status === "warning" ? "#eab308" : "#22c55e";

                  return (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="w-20 font-mono text-slate-warm shrink-0">
                        {period.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-earth-deep/30 overflow-hidden">
                        {period.ndviMean !== null && (
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(5, (period.ndviMean + 0.2) / 1.2 * 100)}%`,
                              backgroundColor: statusColor,
                            }}
                          />
                        )}
                      </div>
                      <span className="w-12 text-right font-mono text-ink">
                        {period.ndviMean?.toFixed(2) ?? "—"}
                      </span>
                      {period.ndviChange !== null && (
                        <span
                          className="w-14 text-right font-mono"
                          style={{
                            color: period.ndviChange < -8 ? "#ef4444" :
                                   period.ndviChange > 2 ? "#22c55e" : "#9ca3af",
                          }}
                        >
                          {period.ndviChange > 0 ? "+" : ""}
                          {period.ndviChange.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
