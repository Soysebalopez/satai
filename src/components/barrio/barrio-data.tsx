"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getAirLevel, AIR_LEVEL_LABELS, AIR_LEVEL_COLORS, AQI_THRESHOLDS } from "@/lib/constants";
import type { AirLevel } from "@/lib/constants";
import type { Zone } from "@/lib/zones";

interface ZoneApiData {
  current: Record<string, number>;
  europeanAQI: number;
  daily?: Array<{ date: string; values: Record<string, number> }>;
}

interface WindData {
  current: {
    windSpeed: number;
    windDirectionLabelEs: string;
    temperature: number;
  };
  dispersion: { description: string };
}

const POLLUTANT_LABELS: Record<string, string> = {
  NO2: "Dioxido de nitrogeno",
  SO2: "Dioxido de azufre",
  O3: "Ozono",
  CO: "Monoxido de carbono",
  PM25: "Particulas finas",
  PM10: "Particulas gruesas",
};

export function BarrioData({ zone }: { zone: Zone }) {
  const [data, setData] = useState<ZoneApiData | null>(null);
  const [wind, setWind] = useState<WindData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/polo?zone=${zone.id}`).then((r) => r.json()).catch(() => null),
      fetch("/api/wind").then((r) => r.json()).catch(() => null),
    ]).then(([poloRes, windRes]) => {
      if (poloRes?.zones?.[0]) setData(poloRes.zones[0]);
      setWind(windRes);
      setLoading(false);
    });
  }, [zone.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-earth-deep/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <p className="text-ink-muted">No se pudieron cargar los datos para esta zona.</p>;
  }

  // Determine overall air level
  const levels: AirLevel[] = [];
  for (const [key, val] of Object.entries(data.current)) {
    const thresholdKey = key as keyof typeof AQI_THRESHOLDS;
    if (AQI_THRESHOLDS[thresholdKey]) {
      levels.push(getAirLevel(thresholdKey, val));
    }
  }
  const priority: AirLevel[] = ["dangerous", "bad", "moderate", "good"];
  const overallLevel = priority.find((p) => levels.includes(p)) || "good";
  const levelColor = AIR_LEVEL_COLORS[overallLevel];
  const levelLabel = AIR_LEVEL_LABELS[overallLevel];

  return (
    <div className="space-y-6">
      {/* Status + wind row */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
        {/* Air quality status */}
        <div className="rounded-xl border border-earth-deep bg-white/60 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-4 w-4 rounded-full semaphore-pulse"
              style={{ backgroundColor: levelColor, color: levelColor }}
            />
            <span className="text-2xl font-semibold tracking-tight" style={{ color: levelColor }}>
              {levelLabel}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            Calidad del aire actual en {zone.name} segun umbrales OMS.
          </p>
        </div>

        {/* Wind */}
        {wind?.current && (
          <div className="rounded-xl border border-earth-deep bg-white/60 p-6">
            <p className="text-[10px] font-mono tracking-wider uppercase text-ink-muted mb-2">Viento</p>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#3b82f6]" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                style={{ transform: `rotate(${180}deg)` }}>
                <path d="M12 2l0 20M12 2l-4 4M12 2l4 4" />
              </svg>
              <span className="text-lg font-semibold text-ink">{wind.current.windSpeed} km/h</span>
              <span className="text-sm text-slate-warm">{wind.current.windDirectionLabelEs}</span>
              <span className="text-sm text-ink-muted ml-auto">{wind.current.temperature}&deg;C</span>
            </div>
            {wind.dispersion && (
              <p className="text-xs text-ink-muted mt-2">{wind.dispersion.description}</p>
            )}
          </div>
        )}
      </div>

      {/* Pollutant cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(data.current).map(([key, val]) => {
          const thresholdKey = key as keyof typeof AQI_THRESHOLDS;
          const level = AQI_THRESHOLDS[thresholdKey] ? getAirLevel(thresholdKey, val) : "good" as AirLevel;
          const color = AIR_LEVEL_COLORS[level];

          return (
            <div key={key} className="rounded-xl border border-earth-deep bg-white/60 p-4">
              <p className="text-[10px] font-mono text-slate-warm mb-1">{key}</p>
              <p className="text-xl font-semibold tracking-tight text-ink">{val}</p>
              <p className="text-[9px] text-slate-warm">ug/m3</p>
              <div className="flex items-center gap-1 mt-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px]" style={{ color }}>
                  {AIR_LEVEL_LABELS[level]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily history chart */}
      {data.daily && data.daily.length > 1 && (
        <div className="rounded-xl border border-earth-deep bg-white/60 p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Evolucion reciente — NO2</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.daily} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="no2-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-earth-deep)" strokeOpacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--color-slate-warm)" }}
                tickFormatter={(d: string) => d.split("-").slice(1).join("/")}
                axisLine={{ stroke: "var(--color-earth-deep)" }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: "var(--color-slate-warm)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "white", border: "1px solid var(--color-earth-deep)", borderRadius: "8px", fontSize: "11px" }}
                formatter={(value) => [`${value} ug/m3`, "NO2"]}
              />
              <Area type="monotone" dataKey={(d: { values: Record<string, number> }) => d.values?.NO2 ?? 0} stroke="#0d9488" fill="url(#no2-grad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Links to other barrios */}
      <div className="border-t border-earth-deep/30 pt-6 mt-8">
        <p className="text-xs text-ink-muted mb-3">Otros barrios</p>
        <div className="flex flex-wrap gap-2">
          {["ingeniero-white", "centro", "villa-mitre", "noroeste", "palihue", "villa-floresta", "grumbein", "universitario"]
            .filter((id) => id !== zone.id)
            .map((id) => {
              const z = { "ingeniero-white": "Ing. White", centro: "Centro", "villa-mitre": "Villa Mitre", noroeste: "Noroeste", palihue: "Palihue", "villa-floresta": "V. Floresta", grumbein: "Grünbein", universitario: "Universitario" }[id];
              return (
                <a key={id} href={`/barrio/${id}`}
                  className="rounded-lg border border-earth-deep bg-white/40 px-3 py-1.5 text-xs text-ink-muted hover:border-teal/30 hover:text-ink transition-colors">
                  {z}
                </a>
              );
            })}
        </div>
      </div>

      <p className="text-[9px] font-mono text-slate-warm/50 text-center mt-4">
        Fuente: CAMS / Sentinel-5P (via Open-Meteo) — Coordenadas: {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
      </p>
    </div>
  );
}
