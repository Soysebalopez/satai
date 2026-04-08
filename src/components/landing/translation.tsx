"use client";

import * as motion from "motion/react-client";
import { ArrowRight } from "@phosphor-icons/react";

export function Translation() {
  return (
    <section className="py-28 px-6 md:px-12 bg-earth-mid/50">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-12 lg:gap-20 items-start">
          {/* Left — explanation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <p className="text-xs tracking-[0.15em] uppercase text-teal-deep font-medium mb-3">
              Traduccion con IA
            </p>
            <h2 className="text-3xl md:text-4xl tracking-tighter leading-none font-semibold text-ink mb-4">
              Datos complejos,
              <br />
              lenguaje simple
            </h2>
            <p className="text-base text-ink-muted leading-relaxed max-w-[50ch]">
              La inteligencia artificial traduce mediciones tecnicas a
              informacion que cualquier vecino puede entender.
              Sin jerga cientifica, sin numeros crípticos.
            </p>
          </motion.div>

          {/* Right — comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch"
          >
            {/* Raw data */}
            <div className="rounded-2xl border border-earth-deep bg-white/60 backdrop-blur-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-air-dangerous/60" />
                <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-ink-muted">
                  Dato crudo
                </span>
              </div>
              <pre className="text-xs text-ink-muted font-mono leading-loose whitespace-pre-wrap">
{`NO2:  45.2 ug/m3
SO2:  12.8 ug/m3
AQI:  72
Wind: 15 km/h SSW
Temp: 22C
RH:   65%`}
              </pre>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal/10">
                <ArrowRight weight="bold" className="w-4 h-4 text-teal" />
              </div>
            </div>

            {/* Citizen translation */}
            <div className="rounded-2xl border border-teal/15 bg-teal/3 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-1.5 w-1.5 rounded-full bg-air-moderate" />
                <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-teal-deep">
                  Lo que lees
                </span>
              </div>
              <p className="text-sm text-ink leading-relaxed">
                Hoy el aire en <strong>Ingeniero White</strong> esta{" "}
                <span className="text-air-moderate font-semibold">moderado</span>.
                Las emisiones industriales estan un 30% por encima del promedio
                de los ultimos 30 dias. El viento del suroeste puede llevar
                las emisiones hacia <strong>Villa Mitre</strong> esta tarde.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
