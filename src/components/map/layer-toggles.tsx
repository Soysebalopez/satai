"use client";

import { Wind, Fire, CloudSun } from "@phosphor-icons/react";

export type LayerKey = "air" | "wind" | "fires";

interface LayerTogglesProps {
  active: Record<LayerKey, boolean>;
  onToggle: (key: LayerKey) => void;
}

const LAYERS: Array<{ key: LayerKey; label: string; icon: typeof Wind; color: string }> = [
  { key: "air", label: "Aire", icon: CloudSun, color: "#0d9488" },
  { key: "wind", label: "Viento", icon: Wind, color: "#3b82f6" },
  { key: "fires", label: "Incendios", icon: Fire, color: "#f97316" },
];

export function LayerToggles({ active, onToggle }: LayerTogglesProps) {
  return (
    <div className="flex flex-col gap-1">
      {LAYERS.map((layer) => (
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
  );
}
