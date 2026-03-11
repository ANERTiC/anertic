import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { api } from "~/lib/api"

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

const SITE_KEY = "anertic_current_site"

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

  useEffect(() => {
    api<{ items: Site[] }>("site.list")
      .then((data) => {
        setSites(data.items || [])
        const savedId = localStorage.getItem(SITE_KEY)
        const saved = data.items?.find((s) => s.id === savedId)
        setCurrentSite(saved || data.items?.[0] || null)
      })
      .catch(() => {
        setSites([])
      })
      .finally(() => setLoading(false))
  }, [])

  const setSite = useCallback((site: Site) => {
    setCurrentSite(site)
    localStorage.setItem(SITE_KEY, site.id)
  }, [])

  return (
    <SiteContext.Provider value={{ sites, currentSite, setSite, loading }}>
      {children}
    </SiteContext.Provider>
  )
}

export function useSite() {
  return useContext(SiteContext)
}
