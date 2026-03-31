import { Outlet, redirect } from 'react-router'
import { TooltipProvider } from '~/components/ui/tooltip'
import type { Route } from './+types/console'
import {
  getSessionFromRequest,
  destroySession,
} from '~/sessions.server'
import { api, ServerApiError } from '~/lib/api.server'

export interface User {
  id: string
  email: string
  name: string
  picture: string
}

export interface ConsoleContext {
  user: User
}

export function shouldRevalidate({
  formAction,
  defaultShouldRevalidate,
}: {
  formAction?: string
  defaultShouldRevalidate: boolean
}) {
  // Only revalidate auth after form submissions (logout, etc.)
  if (formAction) {
    return defaultShouldRevalidate
  }
  return false
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSessionFromRequest(request)
  if (!session.get('accessToken')) {
    throw redirect('/login')
  }

  try {
    const { result: user } = await api<User>(request, 'auth.me')
    return { user }
  } catch (error) {
    // Re-throw redirects (from api() when refresh fails)
    if (error instanceof Response) throw error
    // Clear session on auth errors
    if (error instanceof ServerApiError && error.code === 'unauthorized') {
      throw redirect('/login', {
        headers: { 'Set-Cookie': await destroySession(session) },
      })
    }
    throw error
  }
}

export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  return (
    <TooltipProvider>
      <Outlet context={{ user: loaderData.user } satisfies ConsoleContext} />
    </TooltipProvider>
  )
}
