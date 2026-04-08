import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { MapLoader } from "@/components/map/map-loader";
import { MapHeaderStatus } from "@/components/map/map-header-status";

export const metadata: Metadata = {
  title: "Mapa — MonitorBB",
  description: "Mapa interactivo de calidad del aire, viento e incendios en Bahia Blanca.",
};

export default function MapaPage() {
  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-earth-deep bg-white/90 backdrop-blur-sm z-20">
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

        <MapHeaderStatus />

        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-warm">
            Bahia Blanca
          </span>
          <span className="text-[10px] font-mono text-teal-deep">
            -38.72, -62.27
          </span>
        </div>
      </header>

      {/* Map */}
      <main className="flex-1 relative min-h-0">
        <MapLoader />
      </main>
    </div>
  );
}
