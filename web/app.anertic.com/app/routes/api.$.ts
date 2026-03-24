import { data } from 'react-router'
import { commitSession, getSessionFromRequest } from '~/sessions.server'
import { fetchBackend, isAuthError, tryRefreshToken } from '~/lib/api.server'
import type { Route } from './+types/api.$'

async function proxy(request: Request, params: Route.ActionArgs['params']) {
  const method = params['*']
  if (!method) {
    return data(
      { ok: false, error: { message: 'Missing method' } },
      { status: 400 }
    )
  }

  const session = await getSessionFromRequest(request)
  const accessToken = session.get('accessToken')
  console.log(accessToken)
  const body = await request.text()

  const res = await fetchBackend(method, body, accessToken)
  const result = await res.json()

  if (isAuthError(result)) {
    const refreshToken = session.get('refreshToken')
    if (refreshToken) {
      const refreshed = await tryRefreshToken(refreshToken)
      if (refreshed) {
        session.set('accessToken', refreshed.token)
        session.set('refreshToken', refreshed.refreshToken)

        const retryRes = await fetchBackend(method, body, refreshed.token)
        const retryResult = await retryRes.json()
        return data(retryResult, {
          headers: { 'Set-Cookie': await commitSession(session) },
        })
      }
    }

    return data(
      {
        ok: false,
        error: { code: 'unauthorized', message: 'Session expired' },
      },
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
