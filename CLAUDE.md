@AGENTS.md

# MonitorBB (SatAI)

Portal ciudadano de monitoreo ambiental para Bahia Blanca.

## Stack
- Next.js 16 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Mapbox GL JS (satellite map)
- Motion (animations)
- Phosphor Icons
- Supabase: Pending (for data persistence)

## Servicios
- GitHub: https://github.com/Soysebalopez/satai
- Linear: SatAI — Monitoreo Satelital Argentina (Whitebay team)
- Deploy: Netlify

## Design System
- Font: Outfit (headings + body) + JetBrains Mono (data)
- Palette: warm white (#fafaf8), teal accent (#0d9488), ink (#1a1d21)
- Semaphore: green (#22c55e), yellow (#eab308), orange (#f97316), red (#ef4444)
- Mesh gradient background with coordinate grid overlay
- Taste skill anti-patterns enforced (no centered hero, no 3-col cards, no gradient text headers)

## Architecture
- Landing: `/` — split-screen hero with satellite radar canvas, mesh gradient, live air/wind data
- Map: `/mapa` — Mapbox GL with data overlay panels (air, wind, fires)
- API routes:
  - `/api/air-quality` — OpenAQ v3 (stations near BB, fallback synthetic data)
  - `/api/wind` — Open-Meteo (current + 12h forecast + dispersion estimate)
  - `/api/fires` — NASA FIRMS VIIRS (100km radius, CSV parse)

## Data Sources (all free)
- ESA Sentinel-5P: NO2, SO2, CO, CH4, O3 (daily)
- OpenAQ: ground stations air quality (real-time)
- Open-Meteo: wind, temp, humidity (hourly)
- NASA FIRMS: active fires (real-time)

## Key Patterns
- Mapbox CSS loaded via `<link>` in `/mapa/layout.tsx` (not import — Turbopack issue)
- MapContainer uses dynamic import with ssr:false via MapLoader client component
- Wind dispersion estimates which BB neighborhoods are downwind from petrochemical hub
- Air level determined by WHO thresholds (worst pollutant wins)
- All API routes have graceful fallbacks (synthetic data if source unavailable)

## Proyecto Whitebay
Este proyecto es parte del ecosistema Whitebay.
