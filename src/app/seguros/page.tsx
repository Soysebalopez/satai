"use client";

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { VerifyForm } from "@/components/seguros/verify-form";

export default function SegurosPage() {
  return (
    <>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css"
        rel="stylesheet"
      />
      <link
        href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css"
        rel="stylesheet"
      />
      <div className="min-h-[100dvh] bg-earth">
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
                <span className="text-xs font-normal text-ink-muted ml-1.5">Seguros</span>
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
          <div className="max-w-xl mb-8">
            <p className="text-xs tracking-[0.15em] uppercase text-teal-deep font-medium mb-3">
              Verificacion satelital
            </p>
            <h1 className="text-3xl md:text-4xl tracking-tighter leading-none font-semibold text-ink mb-3">
              Verificacion de siniestros
            </h1>
            <p className="text-base text-ink-muted leading-relaxed">
              Verifica reclamos de siniestros agropecuarios comparando imagenes
              satelitales Sentinel-2 antes y despues del evento declarado.
              NDVI, cuantificacion de daño, y evidencia con timestamp de ESA.
            </p>
          </div>

          <VerifyForm />
        </main>
      </div>
    </>
  );
}
