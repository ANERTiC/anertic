import * as React from 'react'
import { NavLink, useFetcher, useNavigate, useSearchParams } from 'react-router'
import useSWR from 'swr'
import {
  RiDashboardLine,
  RiCpuLine,
  RiChargingPile2Line,
  RiLightbulbFlashLine,
  RiSettings3Line,
  RiFlashlightLine,
  RiDoorOpenLine,
  RiArrowUpDownLine,
  RiAddLine,
  RiLogoutBoxLine,
  RiArrowLeftLine,
  RiPlugLine,
} from '@remixicon/react'
import { fetcher } from '~/lib/api'
import { getCookie, setCookie } from '~/lib/cookie'
import type { User } from '~/layouts/console'
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '~/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import { cn } from '~/lib/utils'

export interface Site {
  id: string
  name: string
  address: string
  timezone: string
  createdAt: string
}

const SITE_COLORS = [
  'bg-orange-500',
  'bg-pink-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-purple-500',
]

function getSiteColor(index: number) {
  return SITE_COLORS[index % SITE_COLORS.length]
}

const siteNavItems = [
  { to: '/overview', icon: RiDashboardLine, label: 'Overview' },
  { to: '/insights', icon: RiLightbulbFlashLine, label: 'Insights' },
  { to: '/chargers', icon: RiChargingPile2Line, label: 'Chargers' },
  { to: '/rooms', icon: RiDoorOpenLine, label: 'Rooms' },
  { to: '/devices', icon: RiCpuLine, label: 'Devices' },
  { to: '/integrations', icon: RiPlugLine, label: 'Integrations' },
]

function SiteSwitcher({
  sites,
  currentSite,
  isLoading,
  onSelect,
}: {
  sites: Site[]
  currentSite: Site | null
  isLoading: boolean
  onSelect: (site: Site) => void
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <RiFlashlightLine aria-hidden="true" className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {currentSite?.name || 'ANERTiC'}
                </span>
                <span className="truncate text-xs">
                  {currentSite?.timezone || 'Select a site'}
                </span>
              </div>
              <RiArrowUpDownLine
                aria-hidden="true"
                className="ml-auto size-4"
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Sites
            </DropdownMenuLabel>
            {isLoading ? (
              <DropdownMenuItem disabled>Loading&hellip;</DropdownMenuItem>
            ) : sites.length === 0 ? (
              <DropdownMenuItem disabled>No sites</DropdownMenuItem>
            ) : (
              sites.map((site, index) => (
                <DropdownMenuItem
                  key={site.id}
                  onClick={() => onSelect(site)}
                  className="gap-2 p-2"
                >
                  <div
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md text-xs font-semibold text-primary-foreground',
                      getSiteColor(index)
                    )}
                  >
                    {site.name.charAt(0).toUpperCase()}
                  </div>
                  {site.name}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <NavLink to="/sites/create">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <RiAddLine aria-hidden="true" className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Add site
                </div>
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="gap-2 p-2">
              <NavLink to="/">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <RiArrowLeftLine aria-hidden="true" className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">
                  Dashboard
                </div>
              </NavLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AppSidebar({
  user,
  ...props
}: { user: User } & React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const logoutFetcher = useFetcher()

  const { data, isLoading } = useSWR<{ items: Site[] }>(['site.list'], fetcher)
  const sites = data?.items || []
  const siteId = searchParams.get('site') || getCookie('anertic_current_site')
  const currentSite = sites.find((s) => s.id === siteId) || null

  function handleSelectSite(site: Site) {
    setCookie('anertic_current_site', site.id)
    navigate(`/overview?site=${site.id}`)
  }

  function handleSignOut() {
    logoutFetcher.submit(null, { method: 'POST', action: '/logout' })
  }

  const { isMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SiteSwitcher
          sites={sites}
          currentSite={currentSite}
          isLoading={isLoading}
          onSelect={handleSelectSite}
        />
      </SidebarHeader>
      <SidebarContent>
        {/* Site-scoped nav */}
        {currentSite && (
          <SidebarGroup>
            <SidebarGroupLabel>{currentSite.name}</SidebarGroupLabel>
            <SidebarMenu>
              {siteNavItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={item.label}>
                    <NavLink
                      to={`${item.to}?site=${currentSite.id}`}
                      className={({ isActive }) =>
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : ''
                      }
                    >
                      <item.icon aria-hidden="true" className="size-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {currentSite && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Settings">
                    <NavLink
                      to={`/settings?site=${currentSite.id}`}
                      className={({ isActive }) =>
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : ''
                      }
                    >
                      <RiSettings3Line aria-hidden="true" className="size-4" />
                      <span>Settings</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Exit to dashboard">
              <NavLink to="/" end>
                <RiArrowLeftLine aria-hidden="true" className="size-4" />
                <span>Exit to dashboard</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage src={user?.picture} alt={user?.name || ''} />
                    <AvatarFallback className="rounded-lg">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.name || 'User'}
                    </span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarImage src={user?.picture} alt={user?.name || ''} />
                      <AvatarFallback className="rounded-lg">
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {user?.name || 'User'}
                      </span>
                      <span className="truncate text-xs">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <RiLogoutBoxLine aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
