import { Outlet, useSearchParams, useNavigate } from "react-router"
import { useEffect } from "react"
import { toast } from "sonner"
import { getSiteCookie } from "~/hooks/use-site"

export default function SiteLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const siteId = searchParams.get("site")

  useEffect(() => {
    if (siteId) return

    const cookieSiteId = getSiteCookie()
    if (cookieSiteId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set("site", cookieSiteId)
          return next
        },
        { replace: true },
      )
    } else {
      toast.info("Please select a site first")
      navigate("/sites", { replace: true })
    }
  }, [siteId, setSearchParams, navigate])

  if (!siteId) return null

  return <Outlet />
}
