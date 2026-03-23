import { redirect } from 'react-router'
import { destroySession, getSessionFromRequest } from '~/sessions.server'
import type { Route } from './+types/logout'

export async function action({ request }: Route.ActionArgs) {
  const session = await getSessionFromRequest(request)
  return redirect('/login', {
    headers: { 'Set-Cookie': await destroySession(session) },
  })
}
