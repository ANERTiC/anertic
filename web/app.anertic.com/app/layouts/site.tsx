import { Outlet, redirect, useOutletContext } from "react-router"
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

  return <Outlet context={{ siteId } satisfies SiteContext} />
}
