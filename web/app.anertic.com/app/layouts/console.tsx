import { Outlet } from "react-router"
import { TooltipProvider } from "~/components/ui/tooltip"
import type { Route } from "./+types/console"
import { requireAuth } from "~/lib/auth"

export function clientLoader({}: Route.ClientLoaderArgs) {
  requireAuth()
  return {}
}

export default function ConsoleLayout({}: Route.ComponentProps) {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}
