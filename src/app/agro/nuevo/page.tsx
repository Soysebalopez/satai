"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { FieldDrawMap } from "@/components/agro/field-draw-map";

export default function NuevoCampoPage() {
  const router = useRouter();

  return (
    <>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css"
        rel="stylesheet"
      />
      <link
        href="https://api.mapbox.com/mapbox-gl-js/plugins/v1.4.3/mapbox-gl-draw.css"
        rel="stylesheet"
      />
      <div className="min-h-[100dvh] bg-earth">
        <header className="border-b border-earth-deep bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-12 py-3">
            <div className="flex items-center gap-3">
              <Link
                href="/agro"
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
              >
                <ArrowLeft weight="bold" className="w-3.5 h-3.5" />
                Mis campos
              </Link>
              <span className="text-earth-deep/40">|</span>
              <span className="text-sm font-semibold tracking-tight text-ink">
                Nuevo campo
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto px-6 md:px-12 py-8">
          <div className="mb-6">
            <h1 className="text-2xl tracking-tighter font-semibold text-ink mb-2">
              Registrar campo
            </h1>
            <p className="text-sm text-ink-muted">
              Dibuja el perimetro de tu campo sobre el mapa satelital.
              Navega hasta la zona y usa la herramienta de poligono.
            </p>
          </div>

          <FieldDrawMap
            onFieldCreated={() => {
              router.push("/agro");
            }}
          />
        </main>
      </div>
    </>
  );
}
