@AGENTS.md

# MonitorBB (SatAI)

Portal ciudadano de monitoreo ambiental para Bahia Blanca.

## Stack
- Next.js 16 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Mapbox GL JS (satellite map)
- Motion (animations)
- Phosphor Icons
- Supabase (ref: qmzuwnilehldvobjsbcs) — subscriptions + alert dedup

## Servicios
- GitHub: https://github.com/Soysebalopez/satai
- Linear: SatAI — Monitoreo Satelital Argentina (Whitebay team)
- Deploy: Netlify (site: monitorbb, ID: ecaed2a9-1a0c-477e-a562-725bc05ab70b)
- Supabase: project ref qmzuwnilehldvobjsbcs
- Telegram Bot: @SatAiAlertsBot (token in .env.local)

## Design System
- Font: Outfit (headings + body) + JetBrains Mono (data)
- Palette: warm white (#fafaf8), teal accent (#0d9488), ink (#1a1d21)
- Semaphore: green (#22c55e), yellow (#eab308), orange (#f97316), red (#ef4444)
- Mesh gradient background with coordinate grid overlay
- Taste skill anti-patterns enforced (no centered hero, no 3-col cards, no gradient text headers)

## Architecture
- Landing: `/` — split-screen hero with satellite radar canvas, mesh gradient, live air/wind data
- Map: `/mapa` — Mapbox GL with data overlay panels (air, wind, fires, simulation)
- Historial: `/historial` — pollutant charts over time
- Simulador: `/simulador` — catastrophe dispersion simulator
- Agro: `/agro` — field monitoring with NDVI (Sentinel-2)
- Polo: `/polo` — petrochemical zone dashboard
- Seguros: `/seguros` — claim verification with SAR flood detection
- Barrios: `/barrio/[slug]` — SSG per-neighborhood pages (8 barrios)
- Sobre: `/sobre` — about page
- API routes:
  - `/api/air-quality` — OpenAQ v3 (stations near BB, fallback synthetic data)
  - `/api/wind` — Open-Meteo (current + 12h forecast + dispersion estimate)
  - `/api/fires` — NASA FIRMS VIIRS (100km radius, CSV parse)
  - `/api/fires/alerts` — fire alerts with ETA by wind dispersión
  - `/api/fires/simulate` — fire dispersion simulation
  - `/api/simulate` — generic event dispersion (gas leak, spill, fire)
  - `/api/satellite` — Sentinel-2 RGB imagery + AI interpretation
  - `/api/summary` — citizen-friendly AI summary (Gemini)
  - `/api/agro/ndvi` — vegetation index per field
  - `/api/polo` + `/api/polo/report` — petrochemical zone data
  - `/api/seguros/verify` — claim verification with Sentinel-1 SAR
  - `/api/bot/telegram` — Telegram bot webhook (commands: /aire, /viento, /incendios, /resumen, /barrio, /barrios, /mis_alertas, /cancelar, /cancelar_todo)
  - `/api/bot/telegram/broadcast` — channel/subscriber alerts (type=daily|weekly|fire)

## Data Sources (all free)
- ESA Sentinel-5P: NO2, SO2, CO, CH4, O3 (daily)
- ESA Sentinel-2: RGB imagery + NDVI vegetation index
- ESA Sentinel-1 SAR: flood detection through clouds (radar)
- OpenAQ: ground stations air quality (real-time)
- Open-Meteo: wind, temp, humidity (hourly)
- NASA FIRMS: active fires (real-time)

## Supabase Tables
- `subscriptions` (chat_id bigint, zone_id text, zone_name text) — Telegram bot barrio subscriptions
- `alerted_fires` (fire_key text, chat_id bigint) — dedup so same fire isn't alerted twice

## Telegram Bot (@SatAiAlertsBot)
- Webhook: POST /api/bot/telegram
- Commands: /aire, /viento, /incendios, /resumen, /barrio <name>, /barrios, /mis_alertas, /cancelar <name>, /cancelar_todo
- Broadcast: GET /api/bot/telegram/broadcast?secret=...&type=daily|weekly|fire
- Channel: t.me/MonitorBBalertas (TELEGRAM_CHANNEL_ID in env)

## Key Patterns
- Mapbox CSS loaded via `<link>` in `/mapa/layout.tsx` (not import — Turbopack issue)
- MapContainer uses dynamic import with ssr:false via MapLoader client component
- Wind dispersion estimates which BB neighborhoods are downwind from petrochemical hub
- Air level determined by WHO thresholds (worst pollutant wins)
- All API routes have graceful fallbacks (synthetic data if source unavailable)
- Supabase client uses lazy init (getSupabase()) — NOT module scope. Netlify evaluates API routes during build when env vars are absent, so module-scope init crashes the build.
- Env vars marked as `isSecret` via Netlify MCP may not persist — always verify with getAllEnvVars after setting

## Project Status
- Fase 1 — Portal Ciudadano (Bahía Blanca): COMPLETE (12/12 issues)
- Fase 2 — Vertical Agro: not started
- Fase 3 — Vertical Ambiental: not started
- Fase 4 — Vertical Seguros: not started
- Related project: AlertaIncendios (separate repo, Linear project created, 6 issues in backlog)

## Proyecto Whitebay
Este proyecto es parte del ecosistema Whitebay.
