import { data } from "react-router"
import { commitSession, getSessionFromRequest } from "~/sessions.server"
import type { Route } from "./+types/api.$"

const API_BASE = process.env.API_URL || "http://localhost:8080"

const AUTH_ERROR_CODES = ["unauthorized", "auth/unauthorized", "auth/token-expired"]

function isAuthError(result: { ok: boolean; error?: { code?: string } }): boolean {
  return !result.ok && AUTH_ERROR_CODES.includes(result.error?.code || "")
}

async function proxy(request: Request, params: Route.ActionArgs["params"]) {
  const method = params["*"]
  if (!method) {
    return data({ ok: false, error: { message: "Missing method" } }, { status: 400 })
  }

  const session = await getSessionFromRequest(request)
  const accessToken = session.get("accessToken")
  const body = await request.text()

  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
  })

  const result = await res.json()

  if (isAuthError(result)) {
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

        const retryRes = await fetch(`${API_BASE}/${method}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshData.result.token}`,
          },
          body,
        })

        const retryResult = await retryRes.json()
        return data(retryResult, {
          headers: { "Set-Cookie": await commitSession(session) },
        })
      }
    }

    return data(
      { ok: false, error: { code: "unauthorized", message: "Session expired" } },
      { status: 401 }
    )
  }

  return data(result)
}

export async function action({ request, params }: Route.ActionArgs) {
  return proxy(request, params)
}

export async function loader({ request, params }: Route.LoaderArgs) {
  return proxy(request, params)
}
