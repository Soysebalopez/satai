"use client";

import React, { useEffect, useRef } from "react";

/**
 * Canvas-based satellite zenith visualization.
 * Renders concentric scan rings, data points, and a sweep line
 * to evoke a satellite scanning the Earth from above.
 */
const SatelliteViz = React.memo(function SatelliteViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    // Data points (simulated sensor readings)
    const dataPoints = Array.from({ length: 24 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: Math.random() * 0.35 + 0.1,
      size: Math.random() * 3 + 1.5,
      pulse: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005,
      color: ["#22c55e", "#eab308", "#0d9488", "#f97316"][Math.floor(Math.random() * 4)],
    }));

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.42;
      const t = frameRef.current;

      ctx.clearRect(0, 0, w, h);

      // Concentric rings
      for (let i = 1; i <= 5; i++) {
        const r = (maxR / 5) * i;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(13, 148, 136, ${0.06 + (i === 5 ? 0.04 : 0)})`;
        ctx.lineWidth = i === 5 ? 1.5 : 0.5;
        ctx.stroke();
      }

      // Cross hairs
      ctx.beginPath();
      ctx.moveTo(cx - maxR, cy);
      ctx.lineTo(cx + maxR, cy);
      ctx.moveTo(cx, cy - maxR);
      ctx.lineTo(cx, cy + maxR);
      ctx.strokeStyle = "rgba(13, 148, 136, 0.05)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Sweep line (radar style)
      const sweepAngle = (t * 0.008) % (Math.PI * 2);
      const sweepGrad = ctx.createConicGradient(sweepAngle, cx, cy);
      sweepGrad.addColorStop(0, "rgba(13, 148, 136, 0.12)");
      sweepGrad.addColorStop(0.06, "rgba(13, 148, 136, 0.03)");
      sweepGrad.addColorStop(0.1, "transparent");
      sweepGrad.addColorStop(1, "transparent");

      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fillStyle = sweepGrad;
      ctx.fill();

      // Sweep line itself
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(sweepAngle) * maxR,
        cy + Math.sin(sweepAngle) * maxR
      );
      ctx.strokeStyle = "rgba(13, 148, 136, 0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Data points
      for (const point of dataPoints) {
        const px = cx + Math.cos(point.angle) * (maxR * point.radius);
        const py = cy + Math.sin(point.angle) * (maxR * point.radius);
        const pulse = Math.sin(t * point.speed + point.pulse) * 0.5 + 0.5;

        // Outer glow
        ctx.beginPath();
        ctx.arc(px, py, point.size + 4 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = point.color + "15";
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(px, py, point.size, 0, Math.PI * 2);
        ctx.fillStyle = point.color + (pulse > 0.5 ? "cc" : "80");
        ctx.fill();
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(13, 148, 136, 0.6)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(13, 148, 136, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Coordinate labels
      ctx.font = "10px var(--font-jetbrains-mono, monospace)";
      ctx.fillStyle = "rgba(13, 148, 136, 0.25)";
      ctx.textAlign = "center";
      ctx.fillText("-38.72\u00b0S", cx, cy - maxR - 8);
      ctx.fillText("-38.74\u00b0S", cx, cy + maxR + 14);
      ctx.textAlign = "left";
      ctx.fillText("-62.28\u00b0W", cx + maxR + 6, cy + 3);
      ctx.textAlign = "right";
      ctx.fillText("-62.26\u00b0W", cx - maxR - 6, cy + 3);

      frameRef.current++;
      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ aspectRatio: "1 / 1" }}
      aria-label="Visualization of satellite scanning Bahia Blanca"
    />
  );
});

export { SatelliteViz };
