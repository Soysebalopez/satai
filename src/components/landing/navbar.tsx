"use client";

import Link from "next/link";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";

const NAV_LINKS = [
  { href: "/mapa", label: "Mapa" },
  { href: "/historial", label: "Historial" },
  { href: "/agro", label: "Agro" },
  { href: "/polo", label: "Ambiental" },
  { href: "/simulador", label: "Simulador" },
  { href: "/sobre", label: "Sobre" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-30">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          Monitor<span className="text-teal-deep">BB</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-medium text-ink-muted hover:text-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden text-ink-muted hover:text-ink transition-colors"
        >
          {open ? <X className="w-5 h-5" weight="bold" /> : <List className="w-5 h-5" weight="bold" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white/95 backdrop-blur-sm border-b border-earth-deep px-6 pb-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm text-ink-muted hover:text-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
