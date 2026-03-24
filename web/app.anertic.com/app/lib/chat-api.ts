import { ApiError } from '~/lib/api'

const AUTH_ERROR_CODES = [
  'unauthorized',
  'auth/unauthorized',
  'auth/token-expired',
]

export async function chatFetcher<T>([method, body]: [
  string,
  unknown?,
]): Promise<T> {
  const res = await fetch(`/api/chat/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const data: {
    ok: boolean
    result: T
    error?: { code?: string; message?: string }
  } = await res.json()

  if (!data.ok) {
    const err = data.error
    if (AUTH_ERROR_CODES.includes(err?.code || '')) {
      window.location.href = '/login'
      throw new Error('Session expired')
    }
    throw new ApiError(err?.code || '', err?.message || 'Unknown error')
  }

  return data.result
}
