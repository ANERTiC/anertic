# Routes

Route files live here. Route definitions are in `../routes.ts` — not file-based routing.

## Layouts

- **Unauthenticated**: `login.tsx` uses `layouts/auth.tsx`
- **Global** (no sidebar): `dashboard.tsx`, `sites.tsx`, `site-create.tsx` via `layouts/global.tsx`
- **Site-scoped** (sidebar): everything else via `layouts/site.tsx` — use `useSiteId()` for current site

## Conventions

- Data fetching: SWR + `api<T>("method.name", body)` — no loaders
- Auth guard handled by `layouts/console.tsx` clientLoader (`requireAuth()`)
- Site ID comes from `?site=` query param, access via `useSiteId()` from `layouts/site.tsx`
- Icons: `@remixicon/react` (`Ri*` components)
- Mutations: call `api()` directly, then `mutate()` the SWR cache
- Use React Router actions for form submissions with `redirect()` / `data()` returns

## Pages

### Auth

- **login.tsx** — Google OAuth sign-in page with branding | APIs: redirect to backend OAuth
- **login-callback.tsx** — OAuth callback, extracts tokens from URL, stores in localStorage, fetches user | APIs: `auth.me`

### Global (no sidebar)

- **dashboard.tsx** — Home page with live energy flow diagram, total consumption, AI insights, site list | APIs: `site.list`, `dashboard.summary`
- **sites.tsx** — Multi-site management with search and grid view | APIs: `site.list`, `site.create`
- **site-create.tsx** — Onboarding form with animated energy node visualization | APIs: `site.create`

### Site-scoped (sidebar)

- **overview.tsx** — Site dashboard with real-time energy flow, AI score, charger status, hourly chart | APIs: site-specific data
- **devices.tsx** — Device inventory with connection status filters and search | APIs: `device.list`
- **device-new.tsx** — Two-step wizard to register new energy metering devices | APIs: `device.create`
- **device-detail.tsx** — Device overview with meters, live readings (power, voltage, current), edit/add meter dialogs | APIs: `device.get`, `device.update`, `device.delete`, `meter.list`, `meter.create`, `reading.latest`
- **chargers.tsx** — EV charger fleet management with live power and utilization | APIs: `charger.list`
- **charger-new.tsx** — Multi-step wizard to register new EV chargers with OCPP setup | APIs: `charger.create`
- **charger-detail.tsx** — Charger status, connectors, session history, remote OCPP commands | APIs: `charger.get`, `charger.update`, `charger.delete`, `charger.sendCommand`, `charger.sessions`, `charger.events`
- **rooms.tsx** — Building layout with floors/rooms showing per-room power and device status | APIs: room/floor/device data
- **insights.tsx** — AI-powered energy insights with charts (savings, hourly patterns, anomalies) | APIs: insights data
- **integrations.tsx** — Third-party platform connections (FusionSolar, SolarEdge, Growatt, Shelly) | APIs: mock
- **settings.tsx** — Site config (name, timezone, tariffs, alerts, webhooks) and team management | APIs: `site.get`, `site.update`, `site.delete`, `site.invite`, `site.members`

### Unused

- **home.tsx** — Placeholder landing page (not routed)
