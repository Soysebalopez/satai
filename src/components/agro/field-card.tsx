"use client";

import Link from "next/link";
import { MapPin, TrendUp, TrendDown, Minus } from "@phosphor-icons/react";
import type { Field } from "@/lib/fields";

interface FieldCardProps {
  field: Field;
  ndvi: number | null;
  ndviChange: number | null;
  status: "ok" | "warning" | "alert" | "loading";
}

const STATUS_CONFIG = {
  ok: { color: "#22c55e", bg: "rgba(34,197,94,0.08)", label: "Sin novedad" },
  warning: { color: "#eab308", bg: "rgba(234,179,8,0.08)", label: "Anomalia leve" },
  alert: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "Atencion" },
  loading: { color: "#9ca3af", bg: "rgba(156,163,175,0.08)", label: "Cargando..." },
};

export function FieldCard({ field, ndvi, ndviChange, status }: FieldCardProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Link
      href={`/agro/campo?id=${field.id}`}
      className="block rounded-xl border border-earth-deep bg-white/60 backdrop-blur-sm p-5 transition-all duration-200 hover:border-teal/30 hover:shadow-sm active:scale-[0.99]"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{field.name}</h3>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-slate-warm" weight="fill" />
            <span className="text-[11px] text-slate-warm">{field.location}</span>
          </div>
        </div>

        {/* Status badge */}
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ backgroundColor: config.bg }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <span className="text-[10px] font-medium" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-warm mb-1">
            NDVI
          </p>
          {ndvi !== null ? (
            <p className="text-2xl font-semibold tracking-tight text-ink">
              {ndvi.toFixed(2)}
            </p>
          ) : (
            <div className="h-7 w-16 rounded bg-earth-deep/20 animate-pulse" />
          )}
        </div>

        {ndviChange !== null && (
          <div className="flex items-center gap-1">
            {ndviChange > 2 ? (
              <TrendUp className="w-4 h-4 text-air-good" weight="bold" />
            ) : ndviChange < -2 ? (
              <TrendDown className="w-4 h-4 text-air-dangerous" weight="bold" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-slate-warm" weight="bold" />
            )}
            <span
              className="text-xs font-mono font-medium"
              style={{
                color: ndviChange > 2 ? "#22c55e" : ndviChange < -2 ? "#ef4444" : "#9ca3af",
              }}
            >
              {ndviChange > 0 ? "+" : ""}
              {ndviChange.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-warm/60 font-mono mt-2">
        {field.area.toFixed(0)} ha
      </p>
    </Link>
  );
}
