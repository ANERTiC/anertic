import { getSessionFromRequest, commitSession } from '~/sessions.server'
import {
  isAuthError,
  tryRefreshToken,
  ServerApiError,
} from '~/lib/api.server'

const AGENTIC_URL = process.env.AGENTIC_URL || 'http://localhost:8082'

interface APIResponse<T> {
  ok: boolean
  result: T
  error?: { code?: string; message?: string }
}

interface ApiResult<T> {
  result: T
  headers?: HeadersInit
}

async function fetchAgentic(
  method: string,
  body: unknown,
  accessToken?: string
): Promise<Response> {
  return fetch(`${AGENTIC_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
  })
}

export async function agenticApi<T>(
  request: Request,
  method: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const session = await getSessionFromRequest(request)
  const accessToken = session.get('accessToken')

  const res = await fetchAgentic(method, body, accessToken)
  const responseData: APIResponse<T> = await res.json()

  if (isAuthError(responseData)) {
    const rt = session.get('refreshToken')
    if (rt) {
      const refreshed = await tryRefreshToken(rt)
      if (refreshed) {
        session.set('accessToken', refreshed.token)
        session.set('refreshToken', refreshed.refreshToken)

        const retryRes = await fetchAgentic(method, body, refreshed.token)
        const retryData: APIResponse<T> = await retryRes.json()
        if (!retryData.ok) {
          const err = retryData.error
          throw new ServerApiError(
            err?.code || '',
            err?.message || 'Unknown error'
          )
        }
        return {
          result: retryData.result,
          headers: { 'Set-Cookie': await commitSession(session) },
        }
      }
    }
    throw new ServerApiError('unauthorized', 'Session expired')
  }

  if (!responseData.ok) {
    const err = responseData.error
    throw new ServerApiError(err?.code || '', err?.message || 'Unknown error')
  }
  return { result: responseData.result }
}
