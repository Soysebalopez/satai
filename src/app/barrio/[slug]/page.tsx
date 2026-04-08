import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ZONES } from "@/lib/zones";
import { BarrioData } from "@/components/barrio/barrio-data";
import { BarrioJsonLd } from "@/components/barrio/barrio-jsonld";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const ZONE_META: Record<string, { title: string; description: string }> = {
  "ingeniero-white": {
    title: "Ingeniero White",
    description: "Calidad del aire y monitoreo ambiental en Ingeniero White, zona del polo petroquimico de Bahia Blanca.",
  },
  centro: {
    title: "Centro",
    description: "Calidad del aire en el centro de Bahia Blanca. Datos satelitales en tiempo real.",
  },
  "villa-mitre": {
    title: "Villa Mitre",
    description: "Monitoreo ambiental en Villa Mitre, Bahia Blanca. Calidad del aire y dispersion de emisiones.",
  },
  "barrio-noroeste": {
    title: "Barrio Noroeste",
    description: "Calidad del aire en Barrio Noroeste, Bahia Blanca. Datos satelitales actualizados.",
  },
  grunbein: {
    title: "Grunbein",
    description: "Monitoreo ambiental en Grunbein, cercano al polo petroquimico de Bahia Blanca.",
  },
  bahia: {
    title: "Estuario de la Bahia",
    description: "Monitoreo del estuario y humedales de Bahia Blanca. Calidad del agua y aire.",
  },
};

export function generateStaticParams() {
  return ZONES.map((zone) => ({ slug: zone.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = ZONE_META[slug];
  if (!meta) return { title: "Barrio — MonitorBB" };

  return {
    title: `${meta.title} — MonitorBB`,
    description: meta.description,
    openGraph: {
      title: `${meta.title} — Calidad del aire en tiempo real`,
      description: meta.description,
      locale: "es_AR",
    },
  };
}

export default async function BarrioPage({ params }: PageProps) {
  const { slug } = await params;
  const zone = ZONES.find((z) => z.id === slug);

  if (!zone) {
    return (
      <div className="min-h-[100dvh] bg-earth flex items-center justify-center">
        <p className="text-ink-muted">Barrio no encontrado</p>
      </div>
    );
  }

  const meta = ZONE_META[slug];

  return (
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

      <main className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
        <div className="max-w-xl mb-10">
          <p className="text-xs tracking-[0.15em] uppercase text-teal-deep font-medium mb-3">
            {zone.type === "industrial" ? "Zona industrial" : zone.type === "coastal" ? "Zona costera" : "Zona residencial"}
          </p>
          <h1 className="text-3xl md:text-4xl tracking-tighter leading-none font-semibold text-ink mb-3">
            {meta?.title || zone.name}
          </h1>
          <p className="text-base text-ink-muted leading-relaxed">
            {zone.description}. Datos atmosfericos en tiempo real derivados del sistema
            CAMS de Copernicus y el satelite Sentinel-5P.
          </p>
        </div>

        <BarrioData zone={zone} />
        <BarrioJsonLd zone={zone} description={meta?.description || ""} />
      </main>
    </div>
  );
}
