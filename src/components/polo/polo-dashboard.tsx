"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface ReportData {
  title: string;
  period: { from: string; to: string; days: number };
  generatedAt: string;
  sections: {
    summary: { content: string };
    currentStatus: {
      levels: Record<string, { value: number; level: string; label: string }>;
    };
    exceedances: {
      data: Array<{ pollutant: string; daysExceeded: number; maxValue: number; threshold: number }>;
    };
    comparison: {
      data: Array<{ pollutant: string; polo: number; residential: number; ratio: number | null; unit: string }>;
    };
    dailyHistory: {
      polo: Array<{ date: string; values: Record<string, number> }>;
      residential: Array<{ date: string; values: Record<string, number> }>;
    };
  };
}

const LEVEL_COLORS: Record<string, string> = {
  good: "#22c55e", moderate: "#eab308", bad: "#f97316", dangerous: "#ef4444", unknown: "#9ca3af",
};

export function PoloDashboard() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/polo/report?days=${days}`)
      .then((r) => r.json())
      .then((data) => { setReport(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-teal border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-ink-muted">Generando reporte...</span>
        </div>
      </div>
    );
  }

  if (!report?.sections) return <p className="text-ink-muted">Error al generar el reporte</p>;

  const { sections } = report;

  // Build comparison chart data
  const comparisonChartData = sections.comparison.data.map((row) => ({
    name: row.pollutant,
    Polo: row.polo,
    Residencial: row.residential,
  }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-muted font-medium">Periodo:</span>
        {[3, 7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] ${
              days === d ? "bg-ink text-earth" : "bg-earth-mid text-ink-muted hover:bg-earth-deep/50"
            }`}
          >
            {d} dias
          </button>
        ))}
      </div>

      {/* Executive summary */}
      <div className="rounded-xl border border-teal/20 bg-teal/3 p-6">
        <p className="text-[10px] font-mono tracking-wider uppercase text-teal-deep mb-2">
          Resumen ejecutivo
        </p>
        <p className="text-sm text-ink leading-relaxed">{sections.summary.content}</p>
        <p className="text-[9px] text-slate-warm/60 font-mono mt-3">
          Periodo: {report.period.from} a {report.period.to} — Generado: {new Date(report.generatedAt).toLocaleString("es-AR")}
        </p>
      </div>

      {/* Current status grid */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Estado actual — Ingeniero White</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(sections.currentStatus.levels).map(([key, data]) => (
            <div key={key} className="rounded-xl border border-earth-deep bg-white/60 p-4 text-center">
              <p className="text-[10px] font-mono text-slate-warm mb-1">{key}</p>
              <p className="text-xl font-semibold tracking-tight text-ink">{data.value}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: LEVEL_COLORS[data.level] || "#9ca3af" }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: LEVEL_COLORS[data.level] || "#9ca3af" }}
                >
                  {data.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exceedances */}
      {sections.exceedances.data.length > 0 && (
        <div className="rounded-xl border border-air-bad/20 bg-air-bad/3 p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Superaciones de umbrales OMS</h3>
          <div className="space-y-2">
            {sections.exceedances.data.map((exc) => (
              <div key={exc.pollutant} className="flex items-center justify-between text-xs">
                <span className="font-mono text-ink">{exc.pollutant}</span>
                <span className="text-ink-muted">
                  {exc.daysExceeded} dia{exc.daysExceeded !== 1 ? "s" : ""} por encima del umbral ({exc.threshold} ug/m3)
                </span>
                <span className="font-mono text-air-bad">max: {exc.maxValue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison chart */}
      <div className="rounded-xl border border-earth-deep bg-white/60 p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">Polo petroquimico vs zonas residenciales</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={comparisonChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-earth-deep)" strokeOpacity={0.5} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
              axisLine={{ stroke: "var(--color-earth-deep)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-slate-warm)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid var(--color-earth-deep)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Bar dataKey="Polo" fill="#0d9488" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Residencial" fill="#9ca3af" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Ratio table */}
        <div className="mt-4 pt-4 border-t border-earth-deep/30">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-warm mb-1">
            <span>Contaminante</span>
            <span className="text-right">Ratio polo/residencial</span>
            <span className="text-right">Estado</span>
          </div>
          {sections.comparison.data.map((row) => (
            <div key={row.pollutant} className="grid grid-cols-3 gap-2 text-xs py-1">
              <span className="font-mono text-ink">{row.pollutant}</span>
              <span className="text-right font-mono text-ink-muted">
                {row.ratio ? `${row.ratio}x` : "—"}
              </span>
              <span
                className="text-right font-medium"
                style={{ color: row.ratio && row.ratio > 1.3 ? "#f97316" : "#22c55e" }}
              >
                {row.ratio && row.ratio > 1.3 ? "Elevado" : "Normal"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[9px] font-mono text-slate-warm/50 text-center">
        Fuente: CAMS / Sentinel-5P (via Open-Meteo) — Umbrales OMS 2021 — Datos modelados, no mediciones directas
      </p>
    </div>
  );
}
