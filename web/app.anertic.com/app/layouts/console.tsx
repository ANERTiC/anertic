import { Outlet, redirect } from "react-router"
import { TooltipProvider } from "~/components/ui/tooltip"
import type { Route } from "./+types/console"
import { getSessionFromRequest } from "~/sessions.server"
import { api } from "~/lib/api.server"

export interface User {
  id: string
  email: string
  name: string
  picture: string
}

export interface ConsoleContext {
  user: User
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSessionFromRequest(request)
  if (!session.get("accessToken")) {
    throw redirect("/login")
  }

  const { result: user } = await api<User>(request, "auth.me")
  return { user }
}

export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  return (
    <TooltipProvider>
      <Outlet context={{ user: loaderData.user } satisfies ConsoleContext} />
    </TooltipProvider>
  )
}
