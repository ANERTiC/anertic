import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes"

export default [
  // API proxy
  route("api/*", "routes/api.$.ts"),

  // Logout action
  route("logout", "routes/logout.ts"),

  // Unauthenticated layout
  layout("layouts/auth.tsx", [
    route("login", "routes/login.tsx"),
  ]),

  // OAuth callback (no layout)
  route("login/callback", "routes/login-callback.tsx"),

  // Authenticated
  layout("layouts/console.tsx", [
    // Global pages (top bar, no sidebar)
    layout("layouts/global.tsx", [
      index("routes/dashboard.tsx"),
      route("sites", "routes/sites.tsx"),
      route("sites/create", "routes/site-create.tsx"),
    ]),

    // Site-scoped pages (sidebar)
    layout("layouts/site.tsx", [
      route("overview", "routes/overview.tsx"),
      route("chargers", "routes/chargers.tsx"),
      route("chargers/new", "routes/charger-new.tsx"),
      route("chargers/:chargerId", "routes/charger-detail.tsx"),
      route("devices", "routes/devices.tsx"),
      route("devices/new", "routes/device-new.tsx"),
      route("devices/:deviceId", "routes/device-detail.tsx"),
      route("rooms", "routes/rooms.tsx"),
      route("insights", "routes/insights.tsx"),
      route("integrations", "routes/integrations.tsx"),
      route("settings", "routes/settings.tsx"),
    ]),
  ]),
] satisfies RouteConfig
