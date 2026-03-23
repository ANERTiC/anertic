import { data } from "react-router"
import { commitSession, getSessionFromRequest } from "~/sessions.server"
import type { Route } from "./+types/api.$"

const API_BASE = process.env.API_URL || "http://localhost:8080"

async function proxy(request: Request, params: Route.ActionArgs["params"]) {
  const method = params["*"]
  if (!method) {
    return data({ ok: false, error: { message: "Missing method" } }, { status: 400 })
  }

  const session = await getSessionFromRequest(request)
  const accessToken = session.get("accessToken")
  const body = await request.text()

  let res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
  })

  if (res.status === 401) {
    const refreshToken = session.get("refreshToken")
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/auth.refreshToken`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      const refreshData = await refreshRes.json()

      if (refreshData.ok) {
        session.set("accessToken", refreshData.result.token)
        session.set("refreshToken", refreshData.result.refreshToken)

        res = await fetch(`${API_BASE}/${method}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshData.result.token}`,
          },
          body,
        })

        const result = await res.json()
        return data(result, {
          status: res.status,
          headers: { "Set-Cookie": await commitSession(session) },
        })
      }
    }

    return data(
      { ok: false, error: { code: "unauthorized", message: "Session expired" } },
      { status: 401 }
    )
  }

  const result = await res.json()
  return data(result, { status: res.status })
}

export async function action({ request, params }: Route.ActionArgs) {
  return proxy(request, params)
}

export async function loader({ request, params }: Route.LoaderArgs) {
  return proxy(request, params)
}
