import { getSessionFromRequest, commitSession } from "~/sessions.server"

const API_BASE = process.env.API_URL || "http://localhost:8080"

interface APIResponse<T> {
  ok: boolean
  result: T
  error?: { code?: string; message?: string }
}

const AUTH_ERROR_CODES = ["unauthorized", "auth/unauthorized", "auth/token-expired"]

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

function isAuthError(resp: APIResponse<unknown>): boolean {
  return !resp.ok && AUTH_ERROR_CODES.includes(resp.error?.code || "")
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

  const res = await fetchBackend(method, body, accessToken)
  const responseData: APIResponse<T> = await res.json()

  if (isAuthError(responseData)) {
    const rt = session.get("refreshToken")
    if (rt) {
      const refreshed = await refreshToken(rt)
      if (refreshed) {
        session.set("accessToken", refreshed.token)
        session.set("refreshToken", refreshed.refreshToken)

        const retryRes = await fetchBackend(method, body, refreshed.token)
        const retryData: APIResponse<T> = await retryRes.json()
        if (!retryData.ok) {
          const err = retryData.error
          throw new ServerApiError(err?.code || "", err?.message || "Unknown error")
        }
        return {
          result: retryData.result,
          headers: { "Set-Cookie": await commitSession(session) },
        }
      }
    }
    throw new ServerApiError("unauthorized", "Session expired")
  }

  if (!responseData.ok) {
    const err = responseData.error
    throw new ServerApiError(err?.code || "", err?.message || "Unknown error")
  }
  return { result: responseData.result }
}
