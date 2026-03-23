import { Outlet, redirect } from "react-router"
import type { Route } from "./+types/auth"
import { getSessionFromRequest } from "~/sessions.server"

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSessionFromRequest(request)
  if (session.get("accessToken")) {
    throw redirect("/")
  }
  return null
}

export default function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted">
      <Outlet />
    </div>
  )
}
