import { NextRequest, NextResponse } from "next/server";
import { ZONES } from "@/lib/zones";

/**
 * GET /api/fires/alerts?lat=-38.72&lng=-62.27
 *
 * Returns fire alerts relative to a user's location.
 * Calculates distance, ETA based on wind, and alert level.
 */

export async function GET(request: NextRequest) {
  const userLat = Number(request.nextUrl.searchParams.get("lat") || ZONES[1].lat);
  const userLng = Number(request.nextUrl.searchParams.get("lng") || ZONES[1].lng);

  const origin = new URL(request.url).origin;

  try {
    const [firesRes, windRes] = await Promise.all([
      fetch(`${origin}/api/fires`).then((r) => r.json()),
      fetch(`${origin}/api/wind`).then((r) => r.json()),
    ]);

    const fires = firesRes.fires || [];
    const wind = windRes.current || { windSpeed: 10, windDirection: 180 };

    if (fires.length === 0) {
      return NextResponse.json({
        alertLevel: "none",
        message: "No hay focos de calor activos en la zona.",
        fires: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const alerts = fires.map((fire: { latitude: number; longitude: number; confidence: string; frp: number }) => {
      const distKm = haversineKm(userLat, userLng, fire.latitude, fire.longitude);

      // Calculate if fire is upwind (smoke could reach user)
      const fireAngle = Math.atan2(fire.longitude - userLng, fire.latitude - userLat) * (180 / Math.PI);
      const windBearing = (wind.windDirection + 180) % 360; // direction wind is GOING
      let angleDiff = Math.abs(fireAngle - windBearing);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      const isUpwind = angleDiff < 60; // fire is roughly upwind of user

      // ETA: time for smoke to reach user at wind speed
      const windMs = wind.windSpeed / 3.6;
      const etaMinutes = windMs > 0 && isUpwind ? Math.round((distKm * 1000) / windMs / 60) : -1;

      // Alert level based on distance and wind
      let level: "danger" | "warning" | "info" | "none";
      if (distKm < 20 && isUpwind) level = "danger";
      else if (distKm < 50 && isUpwind) level = "warning";
      else if (distKm < 50) level = "info";
      else level = "none";

      return {
        latitude: fire.latitude,
        longitude: fire.longitude,
        confidence: fire.confidence,
        frp: fire.frp,
        distanceKm: Math.round(distKm * 10) / 10,
        isUpwind,
        etaMinutes,
        level,
      };
    }).sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm);

    const worstLevel = alerts[0]?.level || "none";
    const nearestDanger = alerts.find((a: { level: string }) => a.level === "danger" || a.level === "warning");

    let message: string;
    if (worstLevel === "danger") {
      message = `Foco de calor detectado a ${nearestDanger.distanceKm} km en direccion del viento. Humo podria llegar en ~${nearestDanger.etaMinutes} minutos.`;
    } else if (worstLevel === "warning") {
      message = `Foco de calor a ${nearestDanger.distanceKm} km. El viento podria traer humo hacia tu zona en ~${nearestDanger.etaMinutes} minutos.`;
    } else if (worstLevel === "info") {
      message = `${alerts.length} foco(s) de calor detectado(s) en un radio de 50 km. El viento actual no los dirige hacia tu ubicacion.`;
    } else {
      message = "No hay focos de calor cercanos.";
    }

    return NextResponse.json({
      alertLevel: worstLevel,
      message,
      userLocation: { lat: userLat, lng: userLng },
      windSpeed: wind.windSpeed,
      windDirection: wind.windDirection,
      fires: alerts.filter((a: { level: string }) => a.level !== "none"),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Fire alerts error:", error);
    return NextResponse.json({ error: "No se pudieron generar alertas" }, { status: 502 });
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
