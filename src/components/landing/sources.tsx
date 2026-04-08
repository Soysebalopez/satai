"use client";

import * as motion from "motion/react-client";
import { Globe, GlobeHemisphereEast, Database, CloudSun, Fire } from "@phosphor-icons/react";

const SOURCES = [
  { name: "ESA Copernicus", icon: GlobeHemisphereEast, detail: "Programa europeo de observacion de la Tierra" },
  { name: "Sentinel-5P", icon: Globe, detail: "Atmosfera y calidad del aire" },
  { name: "OpenAQ", icon: Database, detail: "Red global de estaciones terrestres" },
  { name: "Open-Meteo", icon: CloudSun, detail: "Datos meteorologicos abiertos" },
  { name: "NASA FIRMS", icon: Fire, detail: "Sistema de incendios activos" },
] as const;

export function Sources() {
  return (
    <section className="py-20 px-6 md:px-12">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.15em] uppercase text-teal-deep font-medium mb-3">
            Transparencia
          </p>
          <h2 className="text-2xl md:text-3xl tracking-tighter leading-none font-semibold text-ink mb-3">
            Fuentes verificables, datos abiertos
          </h2>
          <p className="text-sm text-ink-muted max-w-[50ch] mx-auto">
            Toda la informacion proviene de fuentes satelitales publicas.
            Cualquier persona puede verificar los datos originales.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {SOURCES.map((source, i) => (
            <motion.div
              key={source.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                type: "spring",
                stiffness: 100,
                damping: 20,
                delay: i * 0.06,
              }}
              className="group flex items-center gap-3 rounded-xl border border-earth-deep bg-white/40 px-4 py-3 transition-all duration-200 hover:border-teal/20 hover:bg-white/70"
            >
              <source.icon
                weight="duotone"
                className="w-4 h-4 text-slate-warm group-hover:text-teal transition-colors duration-200"
              />
              <div>
                <p className="text-sm font-medium text-ink-light">{source.name}</p>
                <p className="text-[10px] text-slate-warm">{source.detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
