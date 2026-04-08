"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { FieldDetail } from "@/components/agro/field-detail";

function FieldDetailContent() {
  const params = useSearchParams();
  const id = params.get("id");

  if (!id) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-muted">Campo no encontrado</p>
      </div>
    );
  }

  return <FieldDetail fieldId={id} />;
}

export default function CampoPage() {
  return (
    <>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css"
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
                Detalle del campo
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-[1400px] mx-auto px-6 md:px-12 py-8">
          <Suspense
            fallback={
              <div className="py-20 text-center">
                <div className="h-8 w-8 rounded-full border-2 border-teal border-t-transparent animate-spin mx-auto mb-3" />
                <span className="text-xs font-mono text-ink-muted">Cargando campo...</span>
              </div>
            }
          >
            <FieldDetailContent />
          </Suspense>
        </main>
      </div>
    </>
  );
}
