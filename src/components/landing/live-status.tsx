"use client";

import React, { useEffect, useState } from "react";
import { getAirLevel, AIR_LEVEL_LABELS, AIR_LEVEL_COLORS } from "@/lib/constants";
import type { AirLevel } from "@/lib/constants";

interface AirData {
  summary: Record<string, { value: number; unit: string }>;
  source: string;
}

interface WindData {
  current: {
    windSpeed: number;
    windDirectionLabelEs: string;
    temperature: number;
  };
  dispersion: {
    description: string;
    affectedAreas: string[];
  };
}

const LiveStatus = React.memo(function LiveStatus() {
  const [wind, setWind] = useState<WindData | null>(null);
  const [level, setLevel] = useState<AirLevel>("moderate");
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const [airRes, windRes] = await Promise.all([
        fetch("/api/air-quality").then((r) => r.json()).catch(() => null),
        fetch("/api/wind").then((r) => r.json()).catch(() => null),
      ]);
      setWind(windRes);

      if (airRes?.summary) {
        const levels: AirLevel[] = [];
        if (airRes.summary.NO2) levels.push(getAirLevel("NO2", airRes.summary.NO2.value));
        if (airRes.summary.SO2) levels.push(getAirLevel("SO2", airRes.summary.SO2.value));
        if (airRes.summary.PM25) levels.push(getAirLevel("PM25", airRes.summary.PM25.value));
        if (airRes.summary.O3) levels.push(getAirLevel("O3", airRes.summary.O3.value));
        const priority: AirLevel[] = ["dangerous", "bad", "moderate", "good"];
        setLevel(priority.find((p) => levels.includes(p)) || "moderate");
      }

      // Fetch AI summary (non-blocking)
      fetch("/api/summary")
        .then((r) => r.json())
        .then((data) => {
          if (data.summary) setAiSummary(data.summary);
        })
        .catch(() => {});
    }
    fetchData();
  }, []);

  const color = AIR_LEVEL_COLORS[level];
  const label = AIR_LEVEL_LABELS[level];

  return (
    <div className="rounded-2xl border border-earth-deep bg-white/60 backdrop-blur-sm px-5 py-4">
      <div className="flex items-center gap-4 mb-2">
        <div
          className="semaphore-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ color }}
        >
          <div
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-medium tracking-wide uppercase text-ink-muted">
              Calidad del aire
            </p>
            <span className="text-xs font-semibold uppercase" style={{ color }}>
              {label}
            </span>
          </div>
          {wind?.current ? (
            <p className="text-sm text-ink-light leading-snug">
              {wind.current.windSpeed} km/h {wind.current.windDirectionLabelEs.toLowerCase()}
              {" — "}
              {wind.current.temperature}&deg;C
            </p>
          ) : (
            <div className="h-4 w-48 rounded bg-earth-deep/30 animate-pulse" />
          )}
        </div>
      </div>

      {/* AI citizen summary */}
      {aiSummary ? (
        <p className="text-sm text-ink-muted leading-relaxed border-t border-earth-deep/50 pt-2 mt-1">
          {aiSummary}
        </p>
      ) : (
        <div className="border-t border-earth-deep/50 pt-2 mt-1 space-y-1.5">
          <div className="h-3 w-full rounded bg-earth-deep/20 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-earth-deep/20 animate-pulse" />
        </div>
      )}
    </div>
  );
});

export { LiveStatus };
