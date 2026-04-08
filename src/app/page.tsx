import { MeshGradientBackground } from "@/components/landing/mesh-gradient";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Translation } from "@/components/landing/translation";
import { Sources } from "@/components/landing/sources";

export default function Home() {
  return (
    <div className="flex flex-col relative">
      {/* Global mesh gradient — fixed behind everything */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <MeshGradientBackground />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Hero />
        <Features />
        <Translation />
        <Sources />

        {/* Footer */}
        <footer className="border-t border-earth-deep py-10 px-6 md:px-12">
          <div className="max-w-[1400px] mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-warm mb-3">Portal</p>
                <div className="flex flex-col gap-1.5">
                  <a href="/mapa" className="text-xs text-ink-muted hover:text-ink transition-colors">Mapa interactivo</a>
                  <a href="/historial" className="text-xs text-ink-muted hover:text-ink transition-colors">Historial</a>
                  <a href="/simulador" className="text-xs text-ink-muted hover:text-ink transition-colors">Simulador de dispersion</a>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-warm mb-3">Barrios</p>
                <div className="flex flex-col gap-1.5">
                  <a href="/barrio/ingeniero-white" className="text-xs text-ink-muted hover:text-ink transition-colors">Ingeniero White</a>
                  <a href="/barrio/centro" className="text-xs text-ink-muted hover:text-ink transition-colors">Centro</a>
                  <a href="/barrio/villa-mitre" className="text-xs text-ink-muted hover:text-ink transition-colors">Villa Mitre</a>
                  <a href="/barrio/grunbein" className="text-xs text-ink-muted hover:text-ink transition-colors">Grunbein</a>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-warm mb-3">Verticales</p>
                <div className="flex flex-col gap-1.5">
                  <a href="/agro" className="text-xs text-ink-muted hover:text-ink transition-colors">Agro — Monitoreo de campos</a>
                  <a href="/polo" className="text-xs text-ink-muted hover:text-ink transition-colors">Ambiental — Polo petroquimico</a>
                  <a href="/seguros" className="text-xs text-ink-muted hover:text-ink transition-colors">Seguros — Verificacion siniestros</a>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-wider uppercase text-slate-warm mb-3">Datos</p>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-warm">ESA Copernicus</span>
                  <span className="text-xs text-slate-warm">Sentinel-2 / Sentinel-5P</span>
                  <span className="text-xs text-slate-warm">Sentinel-1 SAR</span>
                  <span className="text-xs text-slate-warm">NASA FIRMS / Open-Meteo</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-earth-deep/30">
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tracking-tight text-ink">
                  Monitor<span className="text-teal-deep">BB</span>
                </span>
                <span className="text-xs text-slate-warm">
                  Un proyecto de{" "}
                  <a href="https://whitebay.dev" className="text-ink-muted hover:text-ink transition-colors" target="_blank" rel="noopener noreferrer">
                    Whitebay
                  </a>
                </span>
              </div>
              <a href="https://github.com/Soysebalopez/satai" className="text-slate-warm hover:text-ink-muted transition-colors" target="_blank" rel="noopener noreferrer">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
