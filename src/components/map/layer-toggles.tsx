"use client";

import { Wind, Fire, CloudSun, Globe, GlobeHemisphereEast, Drop } from "@phosphor-icons/react";

export type LayerKey = "air" | "wind" | "fires" | "satellite" | "ndvi" | "moisture";

interface LayerTogglesProps {
  active: Record<LayerKey, boolean>;
  onToggle: (key: LayerKey) => void;
}

const LAYERS: Array<{ key: LayerKey; label: string; icon: typeof Wind; color: string; group?: string }> = [
  { key: "air", label: "Aire", icon: CloudSun, color: "#0d9488", group: "Datos" },
  { key: "wind", label: "Viento", icon: Wind, color: "#3b82f6", group: "Datos" },
  { key: "fires", label: "Incendios", icon: Fire, color: "#f97316", group: "Datos" },
  { key: "satellite", label: "Satelite", icon: Globe, color: "#6b7280", group: "Sentinel-2" },
  { key: "ndvi", label: "Vegetacion", icon: GlobeHemisphereEast, color: "#22c55e", group: "Sentinel-2" },
  { key: "moisture", label: "Humedad", icon: Drop, color: "#3b82f6", group: "Sentinel-2" },
];

export function LayerToggles({ active, onToggle }: LayerTogglesProps) {
  const groups = [...new Set(LAYERS.map((l) => l.group))];

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group}>
          <p className="text-[9px] font-mono tracking-wider uppercase text-slate-warm mb-1 px-1">
            {group}
          </p>
          <div className="flex flex-col gap-1">
            {LAYERS.filter((l) => l.group === group).map((layer) => (
              <button
                key={layer.key}
                onClick={() => onToggle(layer.key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                  active[layer.key]
                    ? "bg-white/90 text-ink shadow-sm border border-earth-deep"
                    : "bg-white/40 text-ink-muted border border-transparent hover:bg-white/60"
                }`}
              >
                <layer.icon
                  weight={active[layer.key] ? "duotone" : "regular"}
                  className="w-4 h-4"
                  style={{ color: active[layer.key] ? layer.color : undefined }}
                />
                {layer.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
