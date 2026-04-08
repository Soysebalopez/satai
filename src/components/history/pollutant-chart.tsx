"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AQI_THRESHOLDS } from "@/lib/constants";

interface HistoryPoint {
  date: string;
  value: number;
}

interface PollutantChartProps {
  pollutant: string;
  label: string;
  color: string;
  days?: number;
}

const PollutantChart = React.memo(function PollutantChart({
  pollutant,
  label,
  color,
  days = 7,
}: PollutantChartProps) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState("ug/m3");

  useEffect(() => {
    fetch(`/api/history?pollutant=${pollutant}&days=${days}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.history) {
          setData(res.history);
          setUnit(res.unit || "ug/m3");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pollutant, days]);

  const thresholds = AQI_THRESHOLDS[pollutant as keyof typeof AQI_THRESHOLDS];
  const maxValue = Math.max(...data.map((d) => d.value), thresholds?.moderate || 50);

  if (loading) {
    return (
      <div className="rounded-xl border border-earth-deep bg-white/60 p-5">
        <div className="h-3 w-24 rounded bg-earth-deep/20 animate-pulse mb-4" />
        <div className="h-40 rounded bg-earth-deep/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-earth-deep bg-white/60 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-ink">{label}</h3>
        </div>
        <span className="text-[10px] font-mono text-slate-warm">
          {unit}
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-xs text-slate-warm text-center py-8">
          Sin datos disponibles para este periodo
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${pollutant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-earth-deep)"
              strokeOpacity={0.5}
            />
            {thresholds && (
              <CartesianGrid
                horizontalPoints={[
                  ((maxValue - thresholds.moderate) / maxValue) * 180,
                ]}
                stroke="var(--color-air-moderate)"
                strokeOpacity={0.3}
                strokeDasharray="6 4"
              />
            )}
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--color-slate-warm)" }}
              tickFormatter={(d: string) => {
                const parts = d.split("-");
                return `${parts[2]}/${parts[1]}`;
              }}
              axisLine={{ stroke: "var(--color-earth-deep)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-slate-warm)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid var(--color-earth-deep)",
                borderRadius: "8px",
                fontSize: "11px",
                padding: "6px 10px",
              }}
              formatter={(value) => [`${value} ${unit}`, label]}
              labelFormatter={(d) => {
                const date = new Date(String(d) + "T12:00:00");
                return date.toLocaleDateString("es-AR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                });
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${pollutant})`}
              dot={false}
              activeDot={{ r: 3, stroke: color, strokeWidth: 2, fill: "white" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* WHO threshold legend */}
      {thresholds && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-earth-deep/30">
          <div className="flex items-center gap-1">
            <div className="h-1 w-3 rounded-full bg-air-good" />
            <span className="text-[9px] text-slate-warm">&lt;{thresholds.good}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1 w-3 rounded-full bg-air-moderate" />
            <span className="text-[9px] text-slate-warm">&lt;{thresholds.moderate}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1 w-3 rounded-full bg-air-bad" />
            <span className="text-[9px] text-slate-warm">&lt;{thresholds.bad}</span>
          </div>
          <span className="text-[9px] text-slate-warm/60 ml-auto">Umbrales OMS</span>
        </div>
      )}
    </div>
  );
});

export { PollutantChart };
