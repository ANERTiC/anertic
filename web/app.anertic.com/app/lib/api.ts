import { getToken, getRefreshToken, setTokens, clearAuth } from "./auth"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface APIResponse<T> {
  ok: boolean
  result: T
  error?: string
}

let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth.refreshToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })

    const data: APIResponse<{ token: string; refreshToken: string }> =
      await res.json()
    if (!data.ok) return false

    setTokens(data.result.token, data.result.refreshToken)
    return true
  } catch {
    return false
  }
}

async function fetchWithAuth(method: string, body?: unknown): Promise<Response> {
  const token = getToken()
  return fetch(`${API_BASE}/api/v1/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function api<T>(method: string, body?: unknown): Promise<T> {
  let res = await fetchWithAuth(method, body)

  if (res.status === 401) {
    // Deduplicate concurrent refresh attempts
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken().finally(() => {
        refreshPromise = null
      })
    }

    const refreshed = await refreshPromise
    if (refreshed) {
      res = await fetchWithAuth(method, body)
    } else {
      clearAuth()
      window.location.href = "/login"
      throw new Error("Session expired")
    }
  }

  const data: APIResponse<T> = await res.json()
  if (!data.ok) {
    throw new Error(data.error || "Unknown error")
  }
  return data.result
}
