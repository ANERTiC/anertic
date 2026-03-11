import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes"

export default [
  // Unauthenticated layout
  layout("layouts/auth.tsx", [
    route("login", "routes/login.tsx"),
  ]),

  // OAuth callback (no layout)
  route("login/callback", "routes/login-callback.tsx"),

  // Authenticated (console) layout
  layout("layouts/console.tsx", [
    index("routes/dashboard.tsx"),
    route("sites", "routes/sites.tsx"),
    route("sites/:siteId", "routes/site-detail.tsx"),
    route("devices", "routes/devices.tsx"),
    route("chargers", "routes/chargers.tsx"),
    route("chargers/:chargerId", "routes/charger-detail.tsx"),
    route("insights", "routes/insights.tsx"),
    route("settings", "routes/settings.tsx"),
  ]),
] satisfies RouteConfig
