export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface APIResponse<T> {
  ok: boolean
  result: T
  error?: { code?: string; message?: string }
}

const AUTH_ERROR_CODES = ["unauthorized", "auth/unauthorized", "auth/token-expired"]

export async function fetcher<T>([method, body]: [string, unknown?]): Promise<T> {
  const res = await fetch(`/api/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })

  // Proxy returns 401 only when session is fully expired (refresh failed)
  if (res.status === 401) {
    window.location.href = "/login"
    throw new Error("Session expired")
  }

  const data: APIResponse<T> = await res.json()
  if (!data.ok) {
    const err = data.error
    if (AUTH_ERROR_CODES.includes(err?.code || "")) {
      window.location.href = "/login"
      throw new Error("Session expired")
    }
    throw new ApiError(err?.code || "", err?.message || "Unknown error")
  }
  return data.result
}
