import { data } from 'react-router'
import { getSessionFromRequest, commitSession } from '~/sessions.server'
import { tryRefreshToken } from '~/lib/api.server'
import type { Route } from './+types/api.chat.$'

const AGENTIC_URL = process.env.AGENTIC_URL || 'http://localhost:8082'

async function getAccessToken(request: Request): Promise<{
  token: string
  headers?: HeadersInit
} | null> {
  const session = await getSessionFromRequest(request)
  const accessToken = session.get('accessToken')
  if (accessToken) {
    return { token: accessToken }
  }

  const refreshToken = session.get('refreshToken')
  if (!refreshToken) return null

  const refreshed = await tryRefreshToken(refreshToken)
  if (!refreshed) return null

  session.set('accessToken', refreshed.token)
  session.set('refreshToken', refreshed.refreshToken)
  return {
    token: refreshed.token,
    headers: { 'Set-Cookie': await commitSession(session) },
  }
}

async function proxyStream(request: Request) {
  const auth = await getAccessToken(request)
  if (!auth) {
    return data(
      {
        ok: false,
        error: { code: 'unauthorized', message: 'Session expired' },
      },
      { status: 401 }
    )
  }

  const body = await request.text()
  const upstreamRes = await fetch(`${AGENTIC_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body,
  })

  if (!upstreamRes.ok) {
    return data(
      {
        ok: false,
        error: { code: 'upstream_error', message: 'Chat service error' },
      },
      { status: upstreamRes.status }
    )
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  }
  if (auth.headers) {
    const setCookie =
      auth.headers instanceof Headers
        ? auth.headers.get('Set-Cookie')
        : (auth.headers as Record<string, string>)['Set-Cookie']
    if (setCookie) {
      responseHeaders['Set-Cookie'] = setCookie
    }
  }

  return new Response(upstreamRes.body, { headers: responseHeaders })
}

async function proxyRpc(request: Request, method: string) {
  const auth = await getAccessToken(request)
  if (!auth) {
    return data(
      {
        ok: false,
        error: { code: 'unauthorized', message: 'Session expired' },
      },
      { status: 401 }
    )
  }

  const body = await request.text()
  const upstreamRes = await fetch(`${AGENTIC_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body,
  })

  const result = await upstreamRes.json()

  const responseHeaders: Record<string, string> = {}
  if (auth.headers) {
    const setCookie =
      auth.headers instanceof Headers
        ? auth.headers.get('Set-Cookie')
        : (auth.headers as Record<string, string>)['Set-Cookie']
    if (setCookie) {
      responseHeaders['Set-Cookie'] = setCookie
    }
  }

  return data(result, { headers: responseHeaders })
}

export async function action({ request, params }: Route.ActionArgs) {
  const path = params['*']
  if (!path) {
    return data(
      { ok: false, error: { message: 'Missing method' } },
      { status: 400 }
    )
  }

  if (path === 'stream') {
    return proxyStream(request)
  }

  return proxyRpc(request, path)
}
