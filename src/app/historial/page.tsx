import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { HistoryDashboard } from "@/components/history/history-dashboard";

export const metadata: Metadata = {
  title: "Historial — MonitorBB",
  description:
    "Evolucion de la calidad del aire en Bahia Blanca. Graficos de contaminantes por dia.",
};

export default function HistorialPage() {
  return (
    <div className="min-h-[100dvh] bg-earth">
      {/* Header */}
      <header className="border-b border-earth-deep bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-12 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft weight="bold" className="w-3.5 h-3.5" />
              Inicio
            </Link>
            <span className="text-earth-deep/40">|</span>
            <span className="text-sm font-semibold tracking-tight text-ink">
              Monitor<span className="text-teal-deep">BB</span>
            </span>
          </div>
          <Link
            href="/mapa"
            className="text-xs text-teal-deep hover:text-teal font-medium transition-colors"
          >
            Ver mapa
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
        <div className="max-w-xl mb-10">
          <p className="text-xs tracking-[0.15em] uppercase text-teal-deep font-medium mb-3">
            Historial
          </p>
          <h1 className="text-3xl md:text-4xl tracking-tighter leading-none font-semibold text-ink mb-3">
            Evolucion de la calidad del aire
          </h1>
          <p className="text-base text-ink-muted leading-relaxed">
            Promedios diarios de contaminantes atmosfericos en Bahia Blanca.
            Datos derivados del sistema CAMS de Copernicus y el satelite Sentinel-5P.
          </p>
        </div>

        <HistoryDashboard />

        <p className="text-[10px] font-mono text-slate-warm/50 mt-8 text-center">
          Fuente: Open-Meteo Air Quality API (CAMS / Sentinel-5P) — Umbrales segun guias OMS 2021
        </p>
      </main>
    </div>
  );
}
