import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/bot/telegram/broadcast
 *
 * Sends a custom message to the MonitorBB Telegram channel.
 * Protected by BROADCAST_SECRET.
 *
 * Body: { message: string, secret: string }
 *
 * GET /api/bot/telegram/broadcast?secret=...
 *
 * Auto-generates an environmental summary and posts it to the channel.
 * Intended for cron jobs (e.g., daily 8am briefing).
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
    body: JSON.stringify({
      chat_id: CHANNEL_ID,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: err.description || "Telegram API error" };
  }

  return { ok: true };
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

/** GET — Auto-generate and send environmental summary */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (!secret || secret !== SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const origin = new URL(request.url).origin;

  try {
    // Fetch all data in parallel
    const [airRes, windRes, firesRes] = await Promise.all([
      fetch(`${origin}/api/air-quality`).then((r) => r.json()),
      fetch(`${origin}/api/wind`).then((r) => r.json()),
      fetch(`${origin}/api/fires`).then((r) => r.json()),
    ]);

    // Build the bulletin
    const now = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
    const wind = windRes.current;
    const fireCount = firesRes.count ?? 0;

    const lines: string[] = [
      `<b>MonitorBB — Boletin ambiental</b>`,
      `${now}`,
      ``,
    ];

    // Air quality
    const airEntries = Object.entries(airRes.summary || {}).map(
      ([key, val]: [string, unknown]) => {
        const v = val as { value: number; unit: string };
        return `  ${key}: ${v.value} ${v.unit}`;
      }
    );
    if (airEntries.length > 0) {
      lines.push(`<b>Aire</b>`, ...airEntries, ``);
    }

    // Wind
    if (wind) {
      lines.push(
        `<b>Viento</b>`,
        `  ${wind.windSpeed} km/h del ${wind.windDirectionLabelEs}`,
        `  Temp: ${wind.temperature}°C — Humedad: ${wind.humidity}%`,
        ``
      );
    }

    // Dispersion
    if (windRes.dispersion?.description) {
      lines.push(`<b>Dispersion</b>`, `  ${windRes.dispersion.description}`, ``);
    }

    // Fires
    lines.push(
      `<b>Focos de calor</b>`,
      fireCount > 0
        ? `  ${fireCount} foco(s) detectado(s). ${firesRes.summary?.description || ""}`
        : `  Sin focos en las ultimas 24h`,
      ``
    );

    lines.push(`Fuentes: ESA Copernicus / NASA FIRMS / Open-Meteo`);

    const bulletin = lines.join("\n");
    const result = await sendToChannel(bulletin);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("Broadcast error:", error);
    return NextResponse.json({ ok: false, error: "Failed to generate bulletin" }, { status: 502 });
  }
}
