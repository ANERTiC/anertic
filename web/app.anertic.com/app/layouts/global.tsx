import { Outlet, useNavigate } from "react-router"
import {
  RiFlashlightLine,
  RiLogoutBoxLine,
} from "@remixicon/react"

import { clearAuth, getUser } from "~/lib/auth"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"

export default function GlobalLayout() {
  const navigate = useNavigate()
  const user = getUser()

  function handleSignOut() {
    clearAuth()
    navigate("/login")
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2"
        >
          <RiFlashlightLine className="size-5 text-primary" />
          <span className="text-sm font-semibold">ANERTiC</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-muted">
              <Avatar className="size-8">
                <AvatarImage src={user?.picture} />
                <AvatarFallback className="text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <Avatar className="size-8">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback className="text-xs">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{user?.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <RiLogoutBoxLine />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}
