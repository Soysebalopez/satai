import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { ZONES } from "@/lib/zones";

/**
 * POST /api/bot/telegram
 *
 * Telegram webhook endpoint. Receives updates from Telegram Bot API.
 * Handles commands: /aire, /viento, /incendios, /barrio <name>, /cancelar, /mis_alertas
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

async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...extra }),
  });
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

  try {
    if (text === "/start" || text === "/help") {
      await sendMessage(chatId,
        "MonitorBB — Monitoreo ambiental de Bahia Blanca\n\n" +
        "Comandos:\n" +
        "/aire — Calidad del aire actual\n" +
        "/viento — Viento y dispersion\n" +
        "/incendios — Focos de calor activos\n" +
        "/resumen — Resumen ciudadano con IA\n\n" +
        "Alertas por barrio:\n" +
        "/barrio centro — Suscribirte a alertas de un barrio\n" +
        "/barrios — Ver barrios disponibles\n" +
        "/mis_alertas — Ver tus suscripciones\n" +
        "/cancelar centro — Cancelar alerta de un barrio\n" +
        "/cancelar_todo — Cancelar todas las alertas\n\n" +
        "Canal de alertas: t.me/MonitorBBalertas\n\n" +
        "Datos: ESA Copernicus / NASA FIRMS / Open-Meteo"
      );

    } else if (text === "/aire") {
      const data = await fetch(`${origin}/api/air-quality`).then((r) => r.json());
      const entries = Object.entries(data.summary || {}).map(
        ([key, val]: [string, unknown]) => {
          const v = val as { value: number; unit: string };
          return `${key}: ${v.value} ${v.unit}`;
        }
      );
      await sendMessage(chatId,
        "Calidad del aire — Bahia Blanca\n\n" + entries.join("\n") + "\n\nFuente: CAMS/Sentinel-5P"
      );

    } else if (text === "/viento") {
      const data = await fetch(`${origin}/api/wind`).then((r) => r.json());
      const c = data.current;
      await sendMessage(chatId,
        `Viento: ${c.windSpeed} km/h del ${c.windDirectionLabelEs}\n` +
        `Temperatura: ${c.temperature}°C — Humedad: ${c.humidity}%\n\n` +
        (data.dispersion?.description || "")
      );

    } else if (text === "/incendios") {
      const data = await fetch(`${origin}/api/fires`).then((r) => r.json());
      let reply = data.count > 0
        ? `${data.count} foco(s) de calor detectado(s).\n${data.summary?.description || ""}`
        : "No se detectaron focos de calor en las ultimas 24 horas.";
      reply += "\n\nFuente: NASA FIRMS";
      await sendMessage(chatId, reply);

    } else if (text === "/resumen") {
      const data = await fetch(`${origin}/api/summary`).then((r) => r.json());
      await sendMessage(chatId, data.summary || "No se pudo generar el resumen.");

    } else if (text === "/barrios") {
      const list = ZONES.map((z) => `  ${z.id} — ${z.name} (${z.description})`).join("\n");
      await sendMessage(chatId,
        "Barrios disponibles:\n\n" + list + "\n\nUsa /barrio <nombre> para suscribirte.\nEj: /barrio centro"
      );

    } else if (text.startsWith("/barrio ")) {
      const zoneInput = text.replace("/barrio ", "").toLowerCase().trim();
      const zone = ZONES.find(
        (z) => z.id === zoneInput || z.name.toLowerCase() === zoneInput
      );

      if (!zone) {
        await sendMessage(chatId,
          `No encontre el barrio "${zoneInput}".\nUsa /barrios para ver la lista.`
        );
      } else {
        const { error } = await supabase
          .from("subscriptions")
          .upsert(
            { chat_id: chatId, zone_id: zone.id, zone_name: zone.name },
            { onConflict: "chat_id,zone_id" }
          );

        if (error) {
          console.error("Subscription error:", error);
          await sendMessage(chatId, "Error al suscribirte. Intenta de nuevo.");
        } else {
          await sendMessage(chatId,
            `Te suscribiste a alertas de ${zone.name}.\n` +
            `Vas a recibir notificaciones cuando haya incendios, contaminacion o eventos que afecten tu zona.\n\n` +
            `Usa /mis_alertas para ver tus suscripciones.`
          );
        }
      }

    } else if (text === "/mis_alertas") {
      const { data: subs, error } = await supabase
        .from("subscriptions")
        .select("zone_name")
        .eq("chat_id", chatId);

      if (error || !subs || subs.length === 0) {
        await sendMessage(chatId,
          "No tenes suscripciones activas.\nUsa /barrio <nombre> para suscribirte."
        );
      } else {
        const list = subs.map((s) => `  ${s.zone_name}`).join("\n");
        await sendMessage(chatId,
          `Tus suscripciones:\n\n${list}\n\nUsa /cancelar <barrio> para eliminar una.`
        );
      }

    } else if (text.startsWith("/cancelar ") && text !== "/cancelar_todo") {
      const zoneInput = text.replace("/cancelar ", "").toLowerCase().trim();
      const zone = ZONES.find(
        (z) => z.id === zoneInput || z.name.toLowerCase() === zoneInput
      );

      if (!zone) {
        await sendMessage(chatId, `No encontre el barrio "${zoneInput}".`);
      } else {
        const { error } = await supabase
          .from("subscriptions")
          .delete()
          .eq("chat_id", chatId)
          .eq("zone_id", zone.id);

        if (error) {
          await sendMessage(chatId, "Error al cancelar. Intenta de nuevo.");
        } else {
          await sendMessage(chatId, `Cancelaste las alertas de ${zone.name}.`);
        }
      }

    } else if (text === "/cancelar_todo") {
      await supabase.from("subscriptions").delete().eq("chat_id", chatId);
      await sendMessage(chatId, "Cancelaste todas tus suscripciones.");

    } else {
      await sendMessage(chatId, "Comando no reconocido. Usa /help para ver los comandos disponibles.");
    }
  } catch (err) {
    console.error("Bot error:", err);
    await sendMessage(chatId, "Error al consultar datos. Intenta de nuevo en unos minutos.");
  }

  return NextResponse.json({ ok: true });
}
