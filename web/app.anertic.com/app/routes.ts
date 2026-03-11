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
    route("settings", "routes/settings.tsx"),

    // Site-scoped pages (require ?site= param)
    layout("layouts/site.tsx", [
      route("chargers", "routes/chargers.tsx"),
      route("chargers/:chargerId", "routes/charger-detail.tsx"),
      route("devices", "routes/devices.tsx"),
      route("insights", "routes/insights.tsx"),
    ]),
  ]),
] satisfies RouteConfig
