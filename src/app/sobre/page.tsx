import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Sobre el proyecto — MonitorBB",
  description: "MonitorBB es un portal ciudadano de monitoreo ambiental para Bahia Blanca. Datos satelitales abiertos, traducidos a lenguaje simple.",
};

export default function SobrePage() {
  return (
    <div className="min-h-[100dvh] bg-earth">
      <header className="border-b border-earth-deep bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-12 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors">
              <ArrowLeft weight="bold" className="w-3.5 h-3.5" />
              Inicio
            </Link>
            <span className="text-earth-deep/40">|</span>
            <span className="text-sm font-semibold tracking-tight text-ink">
              Monitor<span className="text-teal-deep">BB</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-12 py-12">
        <h1 className="text-3xl md:text-4xl tracking-tighter leading-none font-semibold text-ink mb-6">
          Sobre MonitorBB
        </h1>

        <div className="prose-like space-y-6 text-[15px] text-ink-light leading-relaxed">
          <p>
            <strong className="text-ink">MonitorBB</strong> es un portal ciudadano de monitoreo ambiental
            para Bahia Blanca, Argentina. Agrega datos de multiples fuentes satelitales y los traduce
            a informacion que cualquier vecino puede entender.
          </p>

          <h2 className="text-xl font-semibold text-ink mt-8 mb-3">Por que existe</h2>
          <p>
            Bahia Blanca alberga uno de los polos petroquimicos mas grandes de Argentina. Los datos
            sobre calidad del aire, emisiones y condiciones ambientales existen — pero estan dispersos
            en fuentes tecnicas, en ingles, y en formatos que requieren conocimiento especializado
            para interpretar.
          </p>
          <p>
            MonitorBB traduce esa informacion a lenguaje simple. No acusa, no alarma — informa.
            Todas las fuentes son verificables y los datos son publicos.
          </p>

          <h2 className="text-xl font-semibold text-ink mt-8 mb-3">Fuentes de datos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "Sentinel-2 (ESA)", desc: "Imagenes multiespectrales cada 5 dias. Vegetacion, agua, cambios en el territorio." },
              { name: "Sentinel-5P (ESA/CAMS)", desc: "Composicion atmosferica: NO2, SO2, CO, O3. Datos diarios de calidad del aire." },
              { name: "Sentinel-1 SAR (ESA)", desc: "Radar de apertura sintetica. Ve a traves de nubes. Deteccion de inundaciones." },
              { name: "NASA FIRMS", desc: "Deteccion de incendios activos en tiempo real por satelite." },
              { name: "Open-Meteo", desc: "Viento, temperatura, humedad. Datos meteorologicos abiertos." },
              { name: "OpenAQ", desc: "Red global de estaciones terrestres de calidad del aire." },
            ].map((source) => (
              <div key={source.name} className="rounded-xl border border-earth-deep bg-white/50 p-4">
                <p className="text-sm font-semibold text-ink mb-1">{source.name}</p>
                <p className="text-xs text-ink-muted">{source.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold text-ink mt-8 mb-3">Que ofrece</h2>
          <div className="space-y-3">
            {[
              { title: "Portal ciudadano", desc: "Mapa interactivo con calidad del aire, viento, incendios. Semaforo por barrio." },
              { title: "Historial", desc: "Evolucion de contaminantes en los ultimos 30 dias con graficos." },
              { title: "Simulador de dispersion", desc: "Modela como se disperzan contaminantes segun el viento actual." },
              { title: "Monitoreo agro", desc: "NDVI satelital para campos agricolas. Detecta estres hidrico y plagas." },
              { title: "Reporte ambiental", desc: "Comparacion del polo petroquimico vs zonas residenciales." },
              { title: "Verificacion de siniestros", desc: "Evidencia satelital antes/despues para reclamos de seguros." },
            ].map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-teal mt-2 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="text-xs text-ink-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold text-ink mt-8 mb-3">Principios</h2>
          <div className="space-y-2">
            {[
              "Informativo y neutral — publicamos datos, no acusaciones",
              "Fuentes verificables — cualquier persona puede consultar los datos originales",
              "Lenguaje simple — sin jerga cientifica, sin numeros cripticos",
              "Codigo abierto — el repositorio es publico en GitHub",
            ].map((principle) => (
              <div key={principle} className="flex gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-ink/30 mt-2 shrink-0" />
                <p className="text-sm text-ink-light">{principle}</p>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold text-ink mt-8 mb-3">Quienes somos</h2>
          <p>
            MonitorBB es un proyecto de{" "}
            <a href="https://whitebay.dev" className="text-teal-deep hover:text-teal transition-colors font-medium" target="_blank" rel="noopener noreferrer">
              Whitebay
            </a>
            , un estudio de desarrollo de software basado en Bahia Blanca.
          </p>

          <div className="border-t border-earth-deep/30 pt-6 mt-8">
            <p className="text-xs text-slate-warm">
              Contacto:{" "}
              <a href="mailto:hola@whitebay.dev" className="text-teal-deep hover:text-teal transition-colors">
                hola@whitebay.dev
              </a>
            </p>
            <p className="text-xs text-slate-warm mt-1">
              Codigo:{" "}
              <a href="https://github.com/Soysebalopez/satai" className="text-teal-deep hover:text-teal transition-colors" target="_blank" rel="noopener noreferrer">
                github.com/Soysebalopez/satai
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
