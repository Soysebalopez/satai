import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/bot/telegram
 *
 * Telegram webhook endpoint. Receives updates from Telegram Bot API.
 * Handles commands: /aire, /viento, /incendios, /barrio <name>
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Set TELEGRAM_BOT_TOKEN in .env.local
 * 3. Register webhook: curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://monitorbb.netlify.app/api/bot/telegram"
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name: string };
  };
}

export async function POST(request: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot not configured" });
  }

  const update: TelegramUpdate = await request.json();
  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim() || "";

  if (!chatId) return NextResponse.json({ ok: true });

  const origin = new URL(request.url).origin;
  let reply = "";

  try {
    if (text === "/start" || text === "/help") {
      reply = "MonitorBB — Monitoreo ambiental de Bahia Blanca\n\n" +
        "/aire — Calidad del aire actual\n" +
        "/viento — Viento y dispersion\n" +
        "/incendios — Focos de calor activos\n" +
        "/resumen — Resumen ciudadano con IA\n\n" +
        "Datos: ESA Copernicus / NASA FIRMS / Open-Meteo";

    } else if (text === "/aire") {
      const data = await fetch(`${origin}/api/air-quality`).then((r) => r.json());
      const entries = Object.entries(data.summary || {}).map(
        ([key, val]: [string, unknown]) => {
          const v = val as { value: number; unit: string };
          return `${key}: ${v.value} ${v.unit}`;
        }
      );
      reply = "Calidad del aire — Bahia Blanca\n\n" + entries.join("\n") + "\n\nFuente: CAMS/Sentinel-5P";

    } else if (text === "/viento") {
      const data = await fetch(`${origin}/api/wind`).then((r) => r.json());
      const c = data.current;
      reply = `Viento: ${c.windSpeed} km/h del ${c.windDirectionLabelEs}\n` +
        `Temperatura: ${c.temperature}°C — Humedad: ${c.humidity}%\n\n` +
        (data.dispersion?.description || "");

    } else if (text === "/incendios") {
      const data = await fetch(`${origin}/api/fires`).then((r) => r.json());
      reply = data.count > 0
        ? `${data.count} foco(s) de calor detectado(s).\n${data.summary?.description || ""}`
        : "No se detectaron focos de calor en las ultimas 24 horas.";
      reply += "\n\nFuente: NASA FIRMS";

    } else if (text === "/resumen") {
      const data = await fetch(`${origin}/api/summary`).then((r) => r.json());
      reply = data.summary || "No se pudo generar el resumen.";

    } else {
      reply = "Comando no reconocido. Usa /help para ver los comandos disponibles.";
    }
  } catch {
    reply = "Error al consultar datos. Intenta de nuevo en unos minutos.";
  }

  // Send reply
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: reply }),
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/bot/telegram/broadcast
 *
 * Sends a message to all subscribers (future: stored in Supabase).
 * For now, sends to a hardcoded channel or chat ID.
 */
