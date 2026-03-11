import { Outlet, useNavigate } from "react-router"
import {
  RiFlashlightLine,
  RiSettings3Line,
  RiLogoutBoxLine,
} from "@remixicon/react"

import { clearAuth, getUser } from "~/lib/auth"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/settings")}
          >
            <RiSettings3Line className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full transition-opacity hover:opacity-80">
                <Avatar className="size-8">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback className="text-xs">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm">
                <p className="font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={handleSignOut}>
                <RiLogoutBoxLine className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
