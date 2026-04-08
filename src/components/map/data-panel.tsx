"use client";

import React, { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

interface AirData {
  summary: Record<string, { value: number; unit: string }>;
  source: string;
}

interface WindData {
  current: {
    windSpeed: number;
    windDirection: number;
    windDirectionLabelEs: string;
  };
  dispersion: { description: string };
}

interface FiresData {
  count: number;
  summary: { description: string };
}

interface DataPanelProps {
  air: AirData | null;
  wind: WindData | null;
  fires: FiresData | null;
  aiSummary: string | null;
  satInterpretation: string | null;
  satLayerName: string | null;
  satLoading: boolean;
  loading: boolean;
}

function CollapsibleCard({
  title,
  accent,
  defaultOpen = true,
  children,
}: {
  title: string;
  accent?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-earth-deep bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-left"
      >
        <p
          className="text-[10px] font-mono tracking-wider uppercase"
          style={{ color: accent || "var(--color-ink-muted)" }}
        >
          {title}
        </p>
        {open ? (
          <CaretUp className="w-3 h-3 text-slate-warm" weight="bold" />
        ) : (
          <CaretDown className="w-3 h-3 text-slate-warm" weight="bold" />
        )}
      </button>
      {open && <div className="px-4 pb-3 -mt-1">{children}</div>}
    </div>
  );
}

function Skeleton({ width = "w-full" }: { width?: string }) {
  return <div className={`h-3 ${width} rounded bg-earth-deep/20 animate-pulse`} />;
}

export function DataPanel({
  air,
  wind,
  fires,
  aiSummary,
  satInterpretation,
  satLayerName,
  satLoading,
  loading,
}: DataPanelProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 w-72 max-h-[calc(100dvh-80px)] overflow-y-auto scrollbar-hide">
      {/* AI Summary */}
      <CollapsibleCard title="Resumen ciudadano" accent="var(--color-teal-deep)">
        {aiSummary ? (
          <p className="text-xs text-ink-light leading-relaxed">{aiSummary}</p>
        ) : (
          <div className="space-y-1.5">
            <Skeleton />
            <Skeleton width="w-3/4" />
          </div>
        )}
      </CollapsibleCard>

      {/* Satellite interpretation */}
      {satLayerName && (
        <CollapsibleCard title={satLayerName} accent="var(--color-ink-muted)">
          {satLoading ? (
            <div className="space-y-1.5">
              <Skeleton />
              <Skeleton width="w-2/3" />
            </div>
          ) : satInterpretation ? (
            <>
              <p className="text-xs text-ink-light leading-relaxed">{satInterpretation}</p>
              <p className="text-[9px] text-slate-warm/60 mt-1.5 font-mono">
                Sentinel-2 L2A / ESA Copernicus
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-warm italic">Cargando Sentinel-2...</p>
          )}
        </CollapsibleCard>
      )}

      {/* Air quality */}
      <CollapsibleCard title="Calidad del aire" defaultOpen={!satLayerName}>
        {loading ? (
          <Skeleton width="w-32" />
        ) : air?.summary ? (
          <div className="space-y-1">
            {Object.entries(air.summary).slice(0, 6).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="font-mono text-ink-muted">{key}</span>
                <span className="font-mono text-ink-light">
                  {val.value} <span className="text-slate-warm">{val.unit}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-warm">Sin datos</p>
        )}
      </CollapsibleCard>

      {/* Wind */}
      <CollapsibleCard title="Viento" defaultOpen={!satLayerName}>
        {loading ? (
          <Skeleton width="w-32" />
        ) : wind?.current ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[#3b82f6]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  transform: `rotate(${wind.current.windDirection + 180}deg)`,
                }}
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
          <p className="text-xs text-slate-warm">Sin datos</p>
        )}
      </CollapsibleCard>

      {/* Fires */}
      {fires && fires.count > 0 && (
        <CollapsibleCard title="Incendios activos" accent="var(--color-air-bad)">
          <p className="text-xs text-ink-muted">{fires.summary.description}</p>
        </CollapsibleCard>
      )}
    </div>
  );
}
