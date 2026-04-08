"use client";

import React, { useState } from "react";
import { PollutantChart } from "./pollutant-chart";

const POLLUTANTS = [
  { key: "NO2", label: "Dioxido de nitrogeno (NO2)", color: "#0d9488" },
  { key: "SO2", label: "Dioxido de azufre (SO2)", color: "#eab308" },
  { key: "O3", label: "Ozono (O3)", color: "#8b5cf6" },
  { key: "PM25", label: "Particulas finas (PM2.5)", color: "#ef4444" },
  { key: "PM10", label: "Particulas gruesas (PM10)", color: "#f97316" },
  { key: "CO", label: "Monoxido de carbono (CO)", color: "#6b7280" },
] as const;

const DAY_OPTIONS = [
  { value: 3, label: "3 dias" },
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
] as const;

export function HistoryDashboard() {
  const [days, setDays] = useState(7);

  return (
    <div>
      {/* Period selector */}
      <div className="flex items-center gap-2 mb-8">
        <span className="text-xs text-ink-muted font-medium">Periodo:</span>
        <div className="flex gap-1">
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                days === opt.value
                  ? "bg-ink text-earth"
                  : "bg-earth-mid text-ink-muted hover:bg-earth-deep/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts grid — asymmetric 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {POLLUTANTS.slice(0, 2).map((p) => (
          <PollutantChart
            key={p.key}
            pollutant={p.key}
            label={p.label}
            color={p.color}
            days={days}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {POLLUTANTS.slice(2).map((p) => (
          <PollutantChart
            key={p.key}
            pollutant={p.key}
            label={p.label}
            color={p.color}
            days={days}
          />
        ))}
      </div>
    </div>
  );
}
