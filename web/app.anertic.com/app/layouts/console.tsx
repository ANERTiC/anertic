import { NavLink, Outlet, useNavigate } from "react-router"
import {
  RiDashboardLine,
  RiBuilding2Line,
  RiCpuLine,
  RiChargingPile2Line,
  RiLightbulbFlashLine,
  RiSettings3Line,
  RiLogoutBoxLine,
} from "@remixicon/react"
import type { Route } from "./+types/console"
import { clearAuth, getUser, requireAuth } from "~/lib/auth"
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
import { Separator } from "~/components/ui/separator"
import { TooltipProvider } from "~/components/ui/tooltip"

const navItems = [
  { to: "/", icon: RiDashboardLine, label: "Dashboard" },
  { to: "/sites", icon: RiBuilding2Line, label: "Sites" },
  { to: "/devices", icon: RiCpuLine, label: "Devices" },
  { to: "/chargers", icon: RiChargingPile2Line, label: "Chargers" },
  { to: "/insights", icon: RiLightbulbFlashLine, label: "Insights" },
]

export function clientLoader({}: Route.ClientLoaderArgs) {
  requireAuth()
  return { user: getUser() }
}

export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData
  const navigate = useNavigate()

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
                {navItems.map((item) => (
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
            <Separator orientation="vertical" className="h-4" />
          </header>
          <div className="flex-1 p-6">
            <Outlet />
          </div>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  )
}
