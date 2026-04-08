"use client";

import React from "react";

const MeshGradientBackground = React.memo(function MeshGradientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Blob 1 — teal/green (vegetation) */}
      <div
        className="mesh-blob"
        style={{
          width: "45%",
          height: "60%",
          top: "-10%",
          right: "-5%",
          background: "radial-gradient(circle, rgba(13, 148, 136, 0.12) 0%, rgba(34, 197, 94, 0.06) 50%, transparent 70%)",
          animationName: "mesh-drift-1",
          animationDuration: "18s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      />
      {/* Blob 2 — blue (water) */}
      <div
        className="mesh-blob"
        style={{
          width: "50%",
          height: "50%",
          bottom: "5%",
          left: "-10%",
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, rgba(14, 165, 233, 0.04) 50%, transparent 70%)",
          animationName: "mesh-drift-2",
          animationDuration: "22s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      />
      {/* Blob 3 — amber/sand (terrain) */}
      <div
        className="mesh-blob"
        style={{
          width: "35%",
          height: "45%",
          top: "30%",
          left: "25%",
          background: "radial-gradient(circle, rgba(217, 186, 130, 0.1) 0%, rgba(234, 179, 8, 0.04) 50%, transparent 70%)",
          animationName: "mesh-drift-3",
          animationDuration: "25s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      />
      {/* Blob 4 — subtle teal accent */}
      <div
        className="mesh-blob"
        style={{
          width: "30%",
          height: "35%",
          bottom: "-5%",
          right: "15%",
          background: "radial-gradient(circle, rgba(13, 148, 136, 0.06) 0%, transparent 60%)",
          animationName: "mesh-drift-4",
          animationDuration: "20s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        }}
      />

      {/* Coordinate grid */}
      <div className="absolute inset-0 coordinate-grid" />

      {/* Topographic contour */}
      <div
        className="contour-lines absolute"
        style={{
          width: "140%",
          height: "140%",
          top: "-20%",
          left: "-20%",
          opacity: 0.4,
        }}
      />
    </div>
  );
});

export { MeshGradientBackground };
