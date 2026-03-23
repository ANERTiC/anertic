import { redirect } from 'react-router'
import type { Route } from './+types/login-callback'
import { getSessionFromRequest, commitSession } from '~/sessions.server'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const refreshToken = url.searchParams.get('refresh_token')

  if (!token || !refreshToken) {
    throw redirect('/login')
  }

  const session = await getSessionFromRequest(request)
  session.set('accessToken', token)
  session.set('refreshToken', refreshToken)

  throw redirect('/', {
    headers: { 'Set-Cookie': await commitSession(session) },
  })
}

export default function LoginCallback() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing in...</p>
    </div>
  )
}
