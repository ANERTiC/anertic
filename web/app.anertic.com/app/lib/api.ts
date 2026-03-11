import { getToken } from "./auth"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080"

interface APIError {
  code?: string
  message?: string
}

interface APIResponse<T> {
  ok: boolean
  result: T
  error?: APIError
}

export class ApiError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function api<T>(method: string, body?: unknown): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data: APIResponse<T> = await res.json()
  if (!data.ok) {
    const err = data.error
    throw new ApiError(err?.code || "", err?.message || "Unknown error")
  }
  return data.result
}
