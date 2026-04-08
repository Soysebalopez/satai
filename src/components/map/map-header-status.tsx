"use client";

import { useEffect, useState } from "react";
import { getAirLevel, AIR_LEVEL_LABELS, AIR_LEVEL_COLORS } from "@/lib/constants";
import type { AirLevel } from "@/lib/constants";

export function MapHeaderStatus() {
  const [level, setLevel] = useState<AirLevel | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [windSpeed, setWindSpeed] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/air-quality").then((r) => r.json()).catch(() => null),
      fetch("/api/wind").then((r) => r.json()).catch(() => null),
    ]).then(([airRes, windRes]) => {
      if (airRes?.summary) {
        const levels: AirLevel[] = [];
        for (const key of ["NO2", "SO2", "PM25", "O3"] as const) {
          if (airRes.summary[key]) levels.push(getAirLevel(key, airRes.summary[key].value));
        }
        const priority: AirLevel[] = ["dangerous", "bad", "moderate", "good"];
        setLevel(priority.find((p) => levels.includes(p)) || "good");
      }
      if (windRes?.current) {
        setTemp(Math.round(windRes.current.temperature));
        setWindSpeed(Math.round(windRes.current.windSpeed));
      }
    });
  }, []);

  if (!level) return null;

  const color = AIR_LEVEL_COLORS[level];
  const label = AIR_LEVEL_LABELS[level];

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      </div>
      {temp !== null && (
        <span className="text-[10px] font-mono text-ink-muted">
          {temp}&deg;C
        </span>
      )}
      {windSpeed !== null && (
        <span className="text-[10px] font-mono text-slate-warm">
          {windSpeed} km/h
        </span>
      )}
    </div>
  );
}
