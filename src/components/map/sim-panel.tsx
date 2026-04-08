"use client";

import { useState, useCallback } from "react";
import { Play, Spinner, X, Crosshair } from "@phosphor-icons/react";

type EventType = "fuga_gas" | "incendio_industrial" | "derrame";

interface SimPanelProps {
  simMode: boolean;
  onToggleMode: () => void;
  simSource: [number, number] | null;
  onSimulate: (eventType: EventType, duration: number) => void;
  simLoading: boolean;
  simResult: {
    summary: string;
    affectedZones: Array<{ name: string; distanceKm: number; etaMinutes: number; concentrationLevel: string }>;
  } | null;
}

const LEVEL_COLORS: Record<string, string> = {
  high: "#ef4444", medium: "#f97316", low: "#eab308", none: "#9ca3af",
};

export function SimPanel({ simMode, onToggleMode, simSource, onSimulate, simLoading, simResult }: SimPanelProps) {
  const [eventType, setEventType] = useState<EventType>("fuga_gas");
  const [duration, setDuration] = useState(60);

  if (!simMode) {
    return (
      <button
        onClick={onToggleMode}
        className="rounded-lg bg-white/70 backdrop-blur-sm border border-earth-deep/50 px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-white/90 transition-all active:scale-[0.97] shadow-sm"
      >
        Simular evento
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-white/90 backdrop-blur-sm border border-air-dangerous/20 p-4 shadow-sm w-64">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono tracking-wider uppercase text-air-dangerous">
          Modo simulacion
        </p>
        <button onClick={onToggleMode} className="text-slate-warm hover:text-ink transition-colors">
          <X className="w-3.5 h-3.5" weight="bold" />
        </button>
      </div>

      {/* Source indicator */}
      <div className="mb-3">
        {simSource ? (
          <div className="flex items-center gap-1.5 text-xs text-ink">
            <Crosshair className="w-3.5 h-3.5 text-air-dangerous" weight="duotone" />
            <span className="font-mono">{simSource[1].toFixed(4)}, {simSource[0].toFixed(4)}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-warm flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 animate-pulse" />
            Click en el mapa para marcar origen
          </p>
        )}
      </div>

      {/* Event type */}
      <div className="space-y-1 mb-3">
        {([["fuga_gas", "Fuga de gas"], ["incendio_industrial", "Incendio"], ["derrame", "Derrame"]] as [EventType, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setEventType(key)}
            className={`w-full text-left rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all active:scale-[0.98] ${
              eventType === key ? "bg-ink text-earth" : "text-ink-muted hover:bg-earth-mid"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Duration */}
      <div className="flex gap-1 mb-3">
        {[30, 60, 120].map((d) => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={`flex-1 rounded-lg py-1 text-[10px] font-medium transition-all ${
              duration === d ? "bg-ink text-earth" : "text-ink-muted hover:bg-earth-mid"
            }`}
          >
            {d}m
          </button>
        ))}
      </div>

      <button
        onClick={() => onSimulate(eventType, duration)}
        disabled={!simSource || simLoading}
        className="w-full rounded-lg bg-air-dangerous px-3 py-2 text-xs font-medium text-white transition-all hover:bg-air-dangerous/90 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        {simLoading ? <Spinner className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" weight="fill" />}
        Simular
      </button>

      {/* Results inline */}
      {simResult && (
        <div className="mt-3 pt-3 border-t border-earth-deep/30">
          <p className="text-[10px] text-air-dangerous font-mono uppercase mb-1">Simulacion</p>
          <p className="text-[11px] text-ink-light leading-relaxed mb-2">{simResult.summary}</p>
          <div className="space-y-1">
            {simResult.affectedZones.filter((z) => z.concentrationLevel !== "none").slice(0, 4).map((z) => (
              <div key={z.name} className="flex items-center justify-between text-[10px]">
                <span className="text-ink-muted">{z.name}</span>
                <span className="font-mono" style={{ color: LEVEL_COLORS[z.concentrationLevel] }}>
                  {z.etaMinutes > 0 ? `${z.etaMinutes} min` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
