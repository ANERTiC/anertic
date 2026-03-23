import { getSessionFromRequest, commitSession } from "~/sessions.server"

const API_BASE = process.env.API_URL || "http://localhost:8080"

interface APIResponse<T> {
  ok: boolean
  result: T
  error?: { code?: string; message?: string }
}

export class ServerApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

async function fetchBackend(
  method: string,
  body: unknown,
  accessToken?: string
): Promise<Response> {
  return fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  })
}

async function refreshToken(
  currentRefreshToken: string
): Promise<{ token: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth.refreshToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    })
    const data: APIResponse<{ token: string; refreshToken: string }> =
      await res.json()
    if (!data.ok) return null
    return data.result
  } catch {
    return null
  }
}

interface ApiResult<T> {
  result: T
  headers?: HeadersInit
}

export async function api<T>(
  request: Request,
  method: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const session = await getSessionFromRequest(request)
  const accessToken = session.get("accessToken")

  let res = await fetchBackend(method, body, accessToken)

  if (res.status === 401) {
    const rt = session.get("refreshToken")
    if (rt) {
      const refreshed = await refreshToken(rt)
      if (refreshed) {
        session.set("accessToken", refreshed.token)
        session.set("refreshToken", refreshed.refreshToken)

        res = await fetchBackend(method, body, refreshed.token)

        const data: APIResponse<T> = await res.json()
        if (!data.ok) {
          const err = data.error
          throw new ServerApiError(err?.code || "", err?.message || "Unknown error")
        }
        return {
          result: data.result,
          headers: { "Set-Cookie": await commitSession(session) },
        }
      }
    }
    throw new ServerApiError("unauthorized", "Session expired")
  }

  const data: APIResponse<T> = await res.json()
  if (!data.ok) {
    const err = data.error
    throw new ServerApiError(err?.code || "", err?.message || "Unknown error")
  }
  return { result: data.result }
}
