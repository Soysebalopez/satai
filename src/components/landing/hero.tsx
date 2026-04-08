"use client";

import React from "react";
import Link from "next/link";
import * as motion from "motion/react-client";
import { ArrowRight, CrosshairSimple } from "@phosphor-icons/react";
import { SatelliteViz } from "./satellite-viz";
import { LiveStatus } from "./live-status";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 20 },
  },
};

export function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex items-center">
      <div className="w-full max-w-[1400px] mx-auto px-6 md:px-12 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 lg:gap-20 items-center">
          {/* Left — Content */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="max-w-2xl"
          >
            {/* Badge */}
            <motion.div variants={item} className="mb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-teal/15 bg-teal/5 px-4 py-1.5">
                <CrosshairSimple weight="duotone" className="w-3.5 h-3.5 text-teal" />
                <span className="text-xs tracking-[0.15em] uppercase text-teal-deep font-medium">
                  Datos satelitales en tiempo real
                </span>
              </span>
            </motion.div>

            {/* Headline — left aligned, asymmetric */}
            <motion.h1
              variants={item}
              className="text-4xl md:text-6xl tracking-tighter leading-none font-semibold text-ink mb-5"
            >
              Monitoreo ambiental
              <br />
              <span className="text-teal-deep">ciudadano</span> para
              <br />
              Bahia Blanca
            </motion.h1>

            <motion.p
              variants={item}
              className="text-base text-ink-muted leading-relaxed max-w-[52ch] mb-8"
            >
              Calidad del aire, direccion del viento e incendios activos.
              Datos del satelite Sentinel traducidos a lenguaje simple por
              inteligencia artificial. Fuentes abiertas, informacion verificable.
            </motion.p>

            {/* Live status — real data */}
            <motion.div variants={item} className="mb-8">
              <LiveStatus />
            </motion.div>

            {/* CTAs */}
            <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/mapa"
                className="group flex items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3 text-sm font-medium text-earth transition-all duration-200 hover:bg-ink-light active:scale-[0.98]"
              >
                Explorar el mapa
                <ArrowRight
                  weight="bold"
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Link>
              <button className="flex items-center justify-center gap-2 rounded-xl border border-earth-deep px-6 py-3 text-sm font-medium text-ink-light transition-all duration-200 hover:border-ink-muted/30 hover:bg-earth-mid active:scale-[0.98]">
                Suscribirse a alertas
              </button>
            </motion.div>
          </motion.div>

          {/* Right — Satellite visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 60, damping: 20, delay: 0.4 }}
            className="hidden lg:block w-[480px] h-[480px] relative"
          >
            <div className="absolute inset-0 rounded-full border border-teal/8" />
            <SatelliteViz />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
