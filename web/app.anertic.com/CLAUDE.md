# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the ANERTiC frontend.

## Build & Run Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server (React Router SSR)
pnpm build            # Production build (SSR)
pnpm start            # Production server (react-router-serve)
pnpm typecheck        # react-router typegen + tsc
pnpm format           # Prettier (ts, tsx)
```

## Stack

- **Framework**: React Router 7 (SSR mode, `ssr: true`) + Vite 7
- **Styling**: Tailwind CSS 4 (via `@tailwindcss/vite`), tw-animate-css
- **Components**: shadcn/ui (radix-nova style, Remixicon icons) + Radix UI
- **Data fetching**: SWR + `fetcher()` through `/api/*` server proxy
- **Server API**: `api(request, method, body)` from `~/lib/api.server` for loaders/actions
- **Charts**: Recharts
- **Auth**: Google OAuth, httpOnly cookie sessions (no localStorage)

## File Structure

```
app/
  routes.ts            # All route definitions (layout + route helpers)
  root.tsx             # HTML shell, global meta, Toaster, ErrorBoundary
  sessions.server.ts   # Cookie session storage (accessToken, refreshToken)
  app.css              # Tailwind entry + custom styles
  lib/
    api.ts             # fetcher([method, body]) — client-side, calls /api/* proxy
    api.server.ts      # api(request, method, body) — server-side, calls backend directly
    cookie.ts          # js-cookie helpers (site selection persistence)
    utils.ts           # cn() (clsx + tailwind-merge)
  hooks/
    use-mobile.ts      # Responsive breakpoint hook
  layouts/
    auth.tsx           # Guest guard (server loader redirects if authenticated)
    console.tsx        # Auth guard (server loader), fetches user via api.server, provides user via outlet context
    global.tsx         # Top-level pages without sidebar (dashboard, sites)
    site.tsx           # Site-scoped layout with sidebar, provides siteId + user via outlet context
  components/
    ui/                # shadcn/ui primitives (button, card, dialog, sidebar, etc.)
    app-sidebar.tsx    # Main navigation sidebar (site switcher, nav links)
    pending-invites.tsx
  routes/
    api.$.ts           # API proxy resource route — forwards to backend with auth from cookie
    logout.ts          # Logout action — destroys session
    login.tsx          # Google OAuth sign-in page
    login-callback.tsx # Server loader: receives tokens from OAuth, creates session cookie
    dashboard.tsx      # Global dashboard (site list + summary)
    overview.tsx       # Site overview (energy flow, AI insights, chargers)
    devices.tsx, chargers.tsx, settings.tsx, etc.
```

## Key Patterns

**Client data fetching** (`lib/api.ts`): Use SWR with `fetcher`:

```ts
import useSWR from 'swr'
import { fetcher } from '~/lib/api'

const { data, isLoading, mutate } = useSWR<ResultType>(
  ['method.name', { param }],
  fetcher
)
```

**Client mutations**: Use `fetcher` directly:

```ts
await fetcher(['method.name', { param }])
```

**Server data loading** (`lib/api.server.ts`): Use in loaders/actions:

```ts
import { api } from '~/lib/api.server'

export async function loader({ request }: Route.LoaderArgs) {
  const { result } = await api<Type>(request, 'method.name', { param })
  return { data: result }
}
```

**Auth flow**: Google OAuth → backend redirects to `/login/callback?token=...&refresh_token=...` → server loader creates httpOnly session cookie → redirect to `/`. Session stores only `accessToken` + `refreshToken`. User data fetched fresh via `api(request, "auth.me")` in console layout loader.

**User context**: Console layout loader fetches user and passes via outlet context. Access with `useOutletContext<ConsoleContext>()`. Type exported from `~/layouts/console`.

**Site context**: Site-scoped routes get `siteId` from `?site=` query param (persisted in cookie). Access via `useSiteId()` hook exported from `layouts/site.tsx`.

**Logout**: POST to `/logout` via `useFetcher().submit(null, { method: "POST", action: "/logout" })`.

**Route naming**: RPC-style methods match backend (`site.list`, `device.create`, `auth.me`).

**Icons**: Use `@remixicon/react` (`Ri*` components). shadcn config uses remixicon as the icon library.

## Environment Variables (Runtime)

| Variable         | Default                 | Description                                    |
| ---------------- | ----------------------- | ---------------------------------------------- |
| `API_URL`        | `http://localhost:8080` | Backend API base URL                           |
| `APP_URL`        | `http://localhost:5173` | Frontend URL (for OAuth redirect)              |
| `SESSION_SECRET` | `dev-secret`            | Signs session cookies (required in production) |

## Deployment

Dockerfile builds SSR app and serves via `react-router-serve` (Node.js) on port 8080. All env vars are runtime, not build-time.
