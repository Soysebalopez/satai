import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ZONES } from "@/lib/zones";

/**
 * POST /api/bot/telegram/broadcast
 * Sends a custom message to the MonitorBB Telegram channel.
 * Protected by BROADCAST_SECRET.
 *
 * Body: { message: string, secret: string }
 *
 * GET /api/bot/telegram/broadcast?secret=...&type=daily|weekly|fire
 * Auto-generates and sends environmental alerts.
 * - daily: environmental bulletin to channel
 * - weekly: weekly summary to channel + subscribers
 * - fire: fire alerts to affected zone subscribers
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const SECRET = process.env.BROADCAST_SECRET;

async function sendToChannel(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    return { ok: false, error: "Bot or channel not configured" };
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.description || "Telegram API error" };
  }

  return { ok: true };
}

async function sendToChat(chatId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

/** POST — Send a custom message */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, secret } = body;

  if (!secret || secret !== SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!message || typeof message !== "string") {
    return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  const result = await sendToChannel(message);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

/** GET — Auto-generate and send environmental alerts */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const type = searchParams.get("type") || "daily";

  if (!secret || secret !== SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  try {
    if (type === "fire") {
      return await handleFireAlerts(origin);
    } else if (type === "weekly") {
      return await handleWeeklySummary(origin);
    } else {
      return await handleDailyBulletin(origin);
    }
  } catch (error) {
    console.error("Broadcast error:", error);
    return NextResponse.json({ ok: false, error: "Failed to generate broadcast" }, { status: 502 });
  }
}

/** Daily bulletin → channel */
async function handleDailyBulletin(origin: string) {
  const [airRes, windRes, firesRes] = await Promise.all([
    fetch(`${origin}/api/air-quality`).then((r) => r.json()),
    fetch(`${origin}/api/wind`).then((r) => r.json()),
    fetch(`${origin}/api/fires`).then((r) => r.json()),
  ]);

  const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const wind = windRes.current;
  const fireCount = firesRes.count ?? 0;

  const lines: string[] = [
    `<b>MonitorBB — Boletin ambiental</b>`,
    now,
    ``,
  ];

  const airEntries = Object.entries(airRes.summary || {}).map(
    ([key, val]: [string, unknown]) => {
      const v = val as { value: number; unit: string };
      return `  ${key}: ${v.value} ${v.unit}`;
    }
  );
  if (airEntries.length > 0) {
    lines.push(`<b>Aire</b>`, ...airEntries, ``);
  }

  if (wind) {
    lines.push(
      `<b>Viento</b>`,
      `  ${wind.windSpeed} km/h del ${wind.windDirectionLabelEs}`,
      `  Temp: ${wind.temperature}°C — Humedad: ${wind.humidity}%`,
      ``
    );
  }

  if (windRes.dispersion?.description) {
    lines.push(`<b>Dispersion</b>`, `  ${windRes.dispersion.description}`, ``);
  }

  lines.push(
    `<b>Focos de calor</b>`,
    fireCount > 0
      ? `  ${fireCount} foco(s) detectado(s). ${firesRes.summary?.description || ""}`
      : `  Sin focos en las ultimas 24h`,
    ``
  );

  lines.push(`Fuentes: ESA Copernicus / NASA FIRMS / Open-Meteo`);

  const result = await sendToChannel(lines.join("\n"));
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

/** Fire alerts → affected zone subscribers */
async function handleFireAlerts(origin: string) {
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("chat_id, zone_id, zone_name");

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "No subscribers" });
  }

  // Group subscribers by zone
  const subsByZone = new Map<string, { chat_id: number; zone_name: string }[]>();
  for (const sub of subs) {
    const existing = subsByZone.get(sub.zone_id) || [];
    existing.push({ chat_id: sub.chat_id, zone_name: sub.zone_name });
    subsByZone.set(sub.zone_id, existing);
  }

  let totalSent = 0;

  // Check fire alerts for each subscribed zone
  for (const [zoneId, subscribers] of subsByZone) {
    const zone = ZONES.find((z) => z.id === zoneId);
    if (!zone) continue;

    const alertRes = await fetch(
      `${origin}/api/fires/alerts?lat=${zone.lat}&lng=${zone.lng}`
    ).then((r) => r.json());

    if (alertRes.alertLevel === "none") continue;

    // Build fire key for dedup
    const fireKey = `${new Date().toISOString().slice(0, 13)}_${zoneId}_${alertRes.alertLevel}`;

    for (const sub of subscribers) {
      // Check if already alerted
      const { data: existing } = await supabase
        .from("alerted_fires")
        .select("id")
        .eq("fire_key", fireKey)
        .eq("chat_id", sub.chat_id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Send alert
      const emoji = alertRes.alertLevel === "danger" ? "🚨" : alertRes.alertLevel === "warning" ? "⚠️" : "ℹ️";
      const message =
        `${emoji} <b>Alerta para ${sub.zone_name}</b>\n\n` +
        `${alertRes.message}\n\n` +
        `Viento: ${alertRes.windSpeed} km/h\n` +
        `Fuente: NASA FIRMS`;

      await sendToChat(sub.chat_id, message);

      // Mark as alerted
      await supabase.from("alerted_fires").insert({ fire_key: fireKey, chat_id: sub.chat_id });

      totalSent++;
    }
  }

  // Also send to channel if there are danger/warning alerts
  return NextResponse.json({ ok: true, sent: totalSent });
}

/** Weekly summary → channel + all subscribers */
async function handleWeeklySummary(origin: string) {
  const summaryRes = await fetch(`${origin}/api/summary`).then((r) => r.json());

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const message =
    `<b>MonitorBB — Resumen semanal</b>\n` +
    `${weekStart.toLocaleDateString("es-AR")} al ${now.toLocaleDateString("es-AR")}\n\n` +
    `${summaryRes.summary || "No se pudo generar el resumen."}\n\n` +
    `Fuentes: ESA Copernicus / NASA FIRMS / Open-Meteo`;

  // Send to channel
  await sendToChannel(message);

  // Send to all subscribers
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("chat_id");

  // Deduplicate chat_ids (user may have multiple zone subscriptions)
  const uniqueChatIds = [...new Set(subs?.map((s) => s.chat_id) || [])];
  for (const chatId of uniqueChatIds) {
    await sendToChat(chatId, message);
  }

  return NextResponse.json({ ok: true, channel: true, subscribers: uniqueChatIds.length });
}
