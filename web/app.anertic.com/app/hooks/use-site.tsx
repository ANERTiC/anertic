import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router"
import { api } from "~/lib/api"
import { getCookie, setCookie } from "~/lib/cookie"

export interface Site {
  id: string
  name: string
  address: string
  timezone: string
  createdAt: string
}

interface SiteContextValue {
  sites: Site[]
  currentSite: Site | null
  setSite: (site: Site) => void
  loading: boolean
}

const SITE_COOKIE = "anertic_current_site"

const SiteContext = createContext<SiteContextValue>({
  sites: [],
  currentSite: null,
  setSite: () => {},
  loading: true,
})

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>([])
  const [currentSite, setCurrentSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    api<{ items: Site[] }>("site.list")
      .then((data) => {
        const items = data.items || []
        setSites(items)

        // Priority: URL ?site= > cookie > first site
        const urlSiteId = searchParams.get("site")
        const cookieSiteId = getCookie(SITE_COOKIE)
        const targetId = urlSiteId || cookieSiteId

        const found = items.find((s) => s.id === targetId)
        const selected = found || items[0] || null

        setCurrentSite(selected)
        if (selected) {
          setCookie(SITE_COOKIE, selected.id)
        }
      })
      .catch(() => {
        setSites([])
      })
      .finally(() => setLoading(false))
  }, [])

  const setSite = useCallback(
    (site: Site) => {
      setCurrentSite(site)
      setCookie(SITE_COOKIE, site.id)
      // Update URL search param
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set("site", site.id)
        return next
      })
    },
    [setSearchParams],
  )

  return (
    <SiteContext.Provider value={{ sites, currentSite, setSite, loading }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}

