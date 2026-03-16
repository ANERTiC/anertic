# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the ANERTiC frontend.

## Build & Run Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server (React Router)
pnpm build            # Production build (SPA, served via nginx)
pnpm typecheck        # react-router typegen + tsc
pnpm format           # Prettier (ts, tsx)
```

## Stack

- **Framework**: React Router 7 (SPA mode, `ssr: false`) + Vite 7
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite`), tw-animate-css
- **Components**: shadcn/ui (radix-nova style, Remixicon icons) + Radix UI
- **Data fetching**: SWR + custom `api()` client
- **Charts**: Recharts
- **Auth**: Google OAuth, tokens in localStorage

## File Structure

```
app/
  routes.ts          # All route definitions (layout + route helpers)
  root.tsx            # HTML shell, global meta, Toaster, ErrorBoundary
  app.css             # Tailwind entry + custom styles
  lib/
    api.ts            # api<T>(method, body) — POST-based RPC client with auto token refresh
    auth.ts           # Token/user management (localStorage), requireAuth(), requireGuest()
    cookie.ts         # js-cookie helpers (site selection persistence)
    utils.ts          # cn() (clsx + tailwind-merge)
  hooks/
    use-mobile.ts     # Responsive breakpoint hook
  layouts/
    auth.tsx          # Unauthenticated layout (login)
    console.tsx       # Auth guard (requireAuth), wraps all authenticated routes
    global.tsx        # Top-level pages without sidebar (dashboard, sites)
    site.tsx          # Site-scoped layout with sidebar, provides siteId via context
  components/
    ui/               # shadcn/ui primitives (button, card, dialog, sidebar, etc.)
    app-sidebar.tsx   # Main navigation sidebar (site switcher, nav links)
    pending-invites.tsx
  routes/
    login.tsx         # Google OAuth redirect
    login-callback.tsx # Receives token from OAuth, stores in localStorage
    dashboard.tsx     # Global dashboard (site list + summary)
    overview.tsx      # Site overview (energy flow, AI insights, chargers)
    devices.tsx, chargers.tsx, settings.tsx, etc.
```

## Key Patterns

**API client** (`lib/api.ts`): All calls are `POST` to `${VITE_API_URL}/${method}` with JSON body. Response envelope: `{ok, result, error}`. On 401, auto-refreshes token via `auth.refreshToken`. Throws `ApiError` with code/message.

**Data fetching**: Use SWR with the api client. Pattern:
```ts
const { data, isLoading, mutate } = useSWR(
  ["method.name", param],
  () => api<ResultType>("method.name", { param })
)
```

**Auth flow**: Google OAuth redirects to `/login/callback?token=...&refresh_token=...`. Tokens stored in `localStorage`. `requireAuth()` in layout clientLoaders guards authenticated routes.

**Site context**: Site-scoped routes get `siteId` from `?site=` query param (persisted in cookie). Access via `useSiteId()` hook exported from `layouts/site.tsx`.

**Route naming**: RPC-style methods match backend (`site.list`, `device.create`, `auth.me`).

**Icons**: Use `@remixicon/react` (`Ri*` components). shadcn config uses remixicon as the icon library.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_APP_URL` | `http://localhost:5173` | Frontend URL (used for OAuth redirect) |

## Deployment

Dockerfile builds SPA and serves via nginx on port 8080. Build args: `VITE_API_URL`, `VITE_APP_URL`.
