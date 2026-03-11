import { Outlet } from "react-router"
import type { Route } from "./+types/auth"
import { requireGuest } from "~/lib/auth"

export function clientLoader({}: Route.ClientLoaderArgs) {
  requireGuest()
  return null
}

export default function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted">
      <Outlet />
    </div>
  )
}
