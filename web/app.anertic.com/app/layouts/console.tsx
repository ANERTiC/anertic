import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router"
import {
  RiDashboardLine,
  RiBuilding2Line,
  RiCpuLine,
  RiChargingPile2Line,
  RiLightbulbFlashLine,
  RiSettings3Line,
  RiLogoutBoxLine,
  RiArrowDownSLine,
  RiCheckLine,
} from "@remixicon/react"
import useSWR from "swr"
import type { Route } from "./+types/console"
import { clearAuth, getUser, requireAuth } from "~/lib/auth"
import { api } from "~/lib/api"
import { setCookie } from "~/lib/cookie"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { TooltipProvider } from "~/components/ui/tooltip"

interface Site {
  id: string
  name: string
  address: string
  timezone: string
  createdAt: string
}

interface NavItem {
  to: string
  icon: typeof RiDashboardLine
  label: string
}

const globalNavItems: NavItem[] = [
  { to: "/", icon: RiDashboardLine, label: "Dashboard" },
  { to: "/sites", icon: RiBuilding2Line, label: "Sites" },
]

const siteNavItems: NavItem[] = [
  { to: "/devices", icon: RiCpuLine, label: "Devices" },
  { to: "/chargers", icon: RiChargingPile2Line, label: "Chargers" },
  { to: "/insights", icon: RiLightbulbFlashLine, label: "Insights" },
]

function SiteNavGroup({ currentSite }: { currentSite: Site | null }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Site</SidebarGroupLabel>
      <SidebarMenu>
        {siteNavItems.map((item) => (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild>
              <NavLink
                to={currentSite ? `${item.to}?site=${currentSite.id}` : item.to}
                className={({ isActive }) =>
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                }
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function clientLoader({}: Route.ClientLoaderArgs) {
  requireAuth()
  return { user: getUser() }
}

function SiteSwitcher({
  sites,
  currentSite,
  onSelect,
  loading,
}: {
  sites: Site[]
  currentSite: Site | null
  onSelect: (site: Site) => void
  loading: boolean
}) {
  if (loading) {
    return <span className="text-sm text-muted-foreground">Loading...</span>
  }

  if (sites.length === 0) {
    return <span className="text-sm text-muted-foreground">No sites</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent">
        <RiBuilding2Line className="size-4 text-muted-foreground" />
        {currentSite?.name || "Select site"}
        <RiArrowDownSLine className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {sites.map((site) => (
          <DropdownMenuItem key={site.id} onClick={() => onSelect(site)}>
            {site.id === currentSite?.id && (
              <RiCheckLine className="mr-2 size-4" />
            )}
            <span className={site.id !== currentSite?.id ? "ml-6" : ""}>
              {site.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const { data, isLoading } = useSWR("site.list", () =>
    api<{ items: Site[] }>("site.list"),
  )
  const sites = data?.items || []
  const siteId = searchParams.get("site")
  const currentSite = sites.find((s) => s.id === siteId) || null

  function handleSelectSite(site: Site) {
    setCookie("anertic_current_site", site.id)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("site", site.id)
      return next
    })
  }

  function handleSignOut() {
    clearAuth()
    navigate("/login")
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
                  A
                </div>
                <span className="text-sm font-semibold">ANERTiC</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Menu</SidebarGroupLabel>
                <SidebarMenu>
                  {globalNavItems.map((item) => (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.to}
                          end={item.to === "/"}
                          className={({ isActive }) =>
                            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
                          }
                        >
                          <item.icon className="size-4" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
              <SiteNavGroup currentSite={currentSite} />
              <SidebarGroup>
                <SidebarGroupLabel>System</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/settings">
                        <RiSettings3Line className="size-4" />
                        <span>Settings</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton className="h-auto py-2">
                        <Avatar className="size-6">
                          <AvatarImage src={user?.picture} />
                          <AvatarFallback>
                            {user?.name?.charAt(0)?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col text-left text-xs leading-tight">
                          <span className="font-medium">{user?.name || "User"}</span>
                          <span className="text-muted-foreground">{user?.email}</span>
                        </div>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
                      <DropdownMenuItem onClick={handleSignOut}>
                        <RiLogoutBoxLine className="mr-2 size-4" />
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <main className="flex flex-1 flex-col">
            <header className="flex h-12 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <SiteSwitcher
                sites={sites}
                currentSite={currentSite}
                onSelect={handleSelectSite}
                loading={isLoading}
              />
            </header>
            <div className="flex-1 p-6">
              <Outlet />
            </div>
          </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}
