"use client";

import * as motion from "motion/react-client";
import { Wind, Fire, CloudSun } from "@phosphor-icons/react";

const FEATURES = [
  {
    icon: CloudSun,
    title: "Calidad del aire",
    description:
      "Mediciones diarias de NO2, SO2, CO y ozono desde Sentinel-5P de la Agencia Espacial Europea. Estaciones terrestres via OpenAQ como referencia cruzada.",
    source: "ESA Sentinel-5P / OpenAQ",
    stat: "Actualizacion diaria",
    accent: "#0d9488",
  },
  {
    icon: Wind,
    title: "Viento y dispersion",
    description:
      "Direccion y velocidad del viento cada hora. Estimacion de hacia que barrios se dispersan las emisiones segun las condiciones actuales.",
    source: "Open-Meteo",
    stat: "Actualizacion horaria",
    accent: "#3b82f6",
  },
  {
    icon: Fire,
    title: "Incendios activos",
    description:
      "Deteccion satelital de focos de calor en el sur de la provincia de Buenos Aires. Alertas cuando un incendio es detectado cerca de zonas pobladas.",
    source: "NASA FIRMS",
    stat: "Tiempo real",
    accent: "#f97316",
  },
] as const;

export function Features() {
  return (
    <section className="py-28 px-6 md:px-12">
      <div className="max-w-[1400px] mx-auto">
        <div className="max-w-lg mb-16">
          <p className="text-xs tracking-[0.15em] uppercase text-teal-deep font-medium mb-3">
            Fuentes de datos
          </p>
          <h2 className="text-3xl md:text-4xl tracking-tighter leading-none font-semibold text-ink mb-4">
            Tres capas de datos ambientales
          </h2>
          <p className="text-base text-ink-muted leading-relaxed max-w-[55ch]">
            Informacion verificable desde fuentes satelitales abiertas.
            Cualquier persona puede consultar los datos originales.
          </p>
        </div>

        {/* Zig-zag layout instead of 3 equal cards */}
        <div className="flex flex-col gap-6">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 20,
                delay: i * 0.08,
              }}
              className={`grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-6 md:gap-12 items-center ${
                i % 2 === 1 ? "md:direction-rtl" : ""
              }`}
              style={i % 2 === 1 ? { direction: "rtl" } : undefined}
            >
              {/* Content side */}
              <div style={{ direction: "ltr" }} className={`${i % 2 === 1 ? "md:text-right" : ""}`}>
                <div className={`flex items-center gap-3 mb-4 ${i % 2 === 1 ? "md:justify-end" : ""}`}>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: feature.accent + "10" }}
                  >
                    <feature.icon
                      weight="duotone"
                      className="w-5 h-5"
                      style={{ color: feature.accent }}
                    />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-ink">
                    {feature.title}
                  </h3>
                </div>

                <p className="text-sm text-ink-muted leading-relaxed max-w-[50ch] mb-3">
                  {feature.description}
                </p>

                <div className={`flex items-center gap-4 text-xs ${i % 2 === 1 ? "md:justify-end" : ""}`}>
                  <span className="font-mono text-teal-deep">{feature.stat}</span>
                  <span className="text-slate-warm">{feature.source}</span>
                </div>
              </div>

              {/* Visual side — data card */}
              <div
                style={{ direction: "ltr" }}
                className="rounded-2xl border border-earth-deep bg-white/50 backdrop-blur-sm p-6 coordinate-grid-dense"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
                    Lectura actual
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: feature.accent }}
                  />
                </div>

                {/* Simulated data bars */}
                <div className="space-y-2.5">
                  {[0.7, 0.45, 0.85, 0.3].map((val, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-warm w-10">
                        {["NO2", "SO2", "CO", "O3"][j]}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-earth-deep/50 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${val * 100}%` }}
                          viewport={{ once: true }}
                          transition={{
                            type: "spring",
                            stiffness: 60,
                            damping: 20,
                            delay: 0.3 + j * 0.1,
                          }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: feature.accent + "60" }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-ink-muted w-12 text-right">
                        {(val * 65).toFixed(1)} ug/m3
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
