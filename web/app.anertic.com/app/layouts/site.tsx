import {
  data,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
  useOutletContext,
} from 'react-router'
import { RiArrowLeftSLine } from '@remixicon/react'
import { Separator } from '~/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '~/components/ui/sidebar'
import { AppSidebar } from '~/components/app-sidebar'
import { SparkLauncher } from '~/components/spark-launcher'
import type { Route } from './+types/site'
import type { ConsoleContext, User } from '~/layouts/console'
import { currentSiteCookie } from '~/cookies.server'

interface SiteContext {
  siteId: string
  user: User
}

export function useSiteId(): string {
  return useOutletContext<SiteContext>().siteId
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  let siteId = url.searchParams.get('site')

  if (!siteId) {
    const cookieSiteId = await currentSiteCookie.parse(
      request.headers.get('Cookie')
    )

    if (cookieSiteId) {
      url.searchParams.set('site', cookieSiteId)
      throw redirect(url.pathname + url.search)
    }
    throw redirect('/sites')
  }

  return data(
    { siteId },
    {
      headers: {
        'Set-Cookie': await currentSiteCookie.serialize(siteId),
      },
    }
  )
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const { siteId } = loaderData
  const { user } = useOutletContext<ConsoleContext>()
  const navigate = useNavigate()
  const location = useLocation()
  const isChat = location.pathname === '/chat'

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <button
              onClick={() => navigate(-1)}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Go back"
            >
              <RiArrowLeftSLine className="size-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ siteId, user } satisfies SiteContext} />
        </div>
      </SidebarInset>
      {!isChat && <SparkLauncher siteId={siteId} />}
    </SidebarProvider>
  )
}
