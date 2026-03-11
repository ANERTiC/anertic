import { Outlet, redirect, useOutletContext } from "react-router"
import { Separator } from "~/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import { AppSidebar } from "~/components/app-sidebar"
import type { Route } from "./+types/site"
import { getCookie } from "~/lib/cookie"

interface SiteContext {
  siteId: string
}

export function useSiteId(): string {
  return useOutletContext<SiteContext>().siteId
}

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url)
  let siteId = url.searchParams.get("site")

  if (!siteId) {
    const cookieSiteId = getCookie("anertic_current_site")
    if (cookieSiteId) {
      url.searchParams.set("site", cookieSiteId)
      throw redirect(url.pathname + url.search)
    }
    throw redirect("/sites")
  }

  return { siteId }
}

export default function SiteLayout({ loaderData }: Route.ComponentProps) {
  const { siteId } = loaderData

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ siteId } satisfies SiteContext} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
