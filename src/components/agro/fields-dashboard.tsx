"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Plant } from "@phosphor-icons/react";
import { getFields, type Field } from "@/lib/fields";
import { FieldCard } from "./field-card";

interface FieldStatus {
  fieldId: string;
  ndvi: number | null;
  ndviChange: number | null;
  status: "ok" | "warning" | "alert" | "loading";
}

export function FieldsDashboard() {
  const [fields, setFields] = useState<Field[]>([]);
  const [statuses, setStatuses] = useState<Map<string, FieldStatus>>(new Map());

  useEffect(() => {
    setFields(getFields());
  }, []);

  // Fetch NDVI for each field
  useEffect(() => {
    if (fields.length === 0) return;

    // Initialize loading states
    const initial = new Map<string, FieldStatus>();
    for (const f of fields) {
      initial.set(f.id, { fieldId: f.id, ndvi: null, ndviChange: null, status: "loading" });
    }
    setStatuses(initial);

    // Fetch in parallel (max 3 concurrent)
    const fetchField = async (field: Field) => {
      try {
        const bbox = field.bbox.join(",");
        const res = await fetch(`/api/agro/ndvi?bbox=${bbox}&weeks=2`);
        const data = await res.json();

        const current = data.current;
        return {
          fieldId: field.id,
          ndvi: current?.ndviMean ?? null,
          ndviChange: current?.ndviChange ?? null,
          status: (current?.status ?? "ok") as "ok" | "warning" | "alert",
        };
      } catch {
        return { fieldId: field.id, ndvi: null, ndviChange: null, status: "ok" as const };
      }
    };

    Promise.all(fields.map(fetchField)).then((results) => {
      const map = new Map<string, FieldStatus>();
      for (const r of results) map.set(r.fieldId, r);
      setStatuses(map);
    });
  }, [fields]);

  const alertCount = Array.from(statuses.values()).filter((s) => s.status === "alert").length;
  const warningCount = Array.from(statuses.values()).filter((s) => s.status === "warning").length;

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Plant className="w-12 h-12 text-earth-deep mb-4" weight="duotone" />
        <h2 className="text-lg font-semibold text-ink mb-2">
          Sin campos registrados
        </h2>
        <p className="text-sm text-ink-muted mb-6 text-center max-w-sm">
          Registra tu primer campo dibujando el perimetro en el mapa.
          Sentinel-2 lo analiza automaticamente cada 5 dias.
        </p>
        <Link
          href="/agro/nuevo"
          className="flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-earth transition-all hover:bg-ink-light active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" weight="bold" />
          Registrar campo
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-muted">
            {fields.length} campo{fields.length !== 1 ? "s" : ""}
          </span>
          {alertCount > 0 && (
            <span className="text-xs font-medium text-air-dangerous">
              {alertCount} con alerta
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs font-medium text-air-moderate">
              {warningCount} con anomalia
            </span>
          )}
        </div>
        <Link
          href="/agro/nuevo"
          className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-xs font-medium text-earth transition-all hover:bg-ink-light active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" weight="bold" />
          Agregar campo
        </Link>
      </div>

      {/* Field grid — asymmetric layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-4">
        {fields.map((field, i) => {
          const s = statuses.get(field.id);
          return (
            <FieldCard
              key={field.id}
              field={field}
              ndvi={s?.ndvi ?? null}
              ndviChange={s?.ndviChange ?? null}
              status={s?.status ?? "loading"}
            />
          );
        })}
      </div>
    </div>
  );
}
