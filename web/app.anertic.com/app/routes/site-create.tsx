import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import {
  RiFlashlightLine,
  RiMapPinLine,
  RiTimeLine,
  RiBuilding2Line,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiSunLine,
  RiPlugLine,
  RiBattery2ChargeLine,
  RiChargingPile2Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { api } from "~/lib/api"
import { setCookie } from "~/lib/cookie"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"

interface CreateResult {
  id: string
}

const timezones = Intl.supportedValuesOf("timeZone")

export default function SiteCreate() {
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [creating, setCreating] = useState(false)

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok",
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const result = await api<CreateResult>("site.create", {
        name,
        address,
        timezone,
      })
      toast.success("Site created successfully")
      setCookie("anertic_current_site", result.id)
      navigate(`/overview?site=${result.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create site")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)]">
      {/* Left panel — illustration / branding */}
      <div className="relative hidden w-[45%] overflow-hidden border-r border-border/40 bg-gradient-to-br from-slate-50 via-primary/[0.04] to-amber-50/40 lg:block">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Floating energy nodes — decorative */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-1000",
            mounted ? "opacity-100" : "opacity-0 translate-y-4",
          )}
        >
          <div className="relative h-80 w-80">
            {/* Center node */}
            <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-border/30 bg-white shadow-xl shadow-black/[0.04]">
              <RiBuilding2Line className="size-8 text-foreground/70" />
            </div>

            {/* Orbiting nodes */}
            {[
              { icon: RiSunLine, color: "text-amber-500", bg: "bg-amber-50", x: -90, y: -80, delay: "100ms" },
              { icon: RiPlugLine, color: "text-cyan-500", bg: "bg-cyan-50", x: 90, y: -60, delay: "200ms" },
              { icon: RiBattery2ChargeLine, color: "text-violet-500", bg: "bg-violet-50", x: 80, y: 70, delay: "300ms" },
              { icon: RiChargingPile2Line, color: "text-emerald-500", bg: "bg-emerald-50", x: -80, y: 60, delay: "400ms" },
            ].map((node, i) => (
              <div
                key={i}
                className={cn(
                  "absolute left-1/2 top-1/2 flex size-12 items-center justify-center rounded-xl border border-border/20 shadow-lg shadow-black/[0.03] transition-all duration-700",
                  node.bg,
                  mounted ? "opacity-100 scale-100" : "opacity-0 scale-75",
                )}
                style={{
                  transform: `translate(calc(-50% + ${node.x}px), calc(-50% + ${node.y}px))`,
                  transitionDelay: node.delay,
                }}
              >
                <node.icon className={cn("size-5", node.color)} />
              </div>
            ))}

            {/* Connecting lines (SVG) */}
            <svg
              className={cn(
                "absolute inset-0 size-full transition-opacity duration-1000 delay-500",
                mounted ? "opacity-100" : "opacity-0",
              )}
              viewBox="0 0 320 320"
            >
              {[
                { x1: 160, y1: 160, x2: 70, y2: 80 },
                { x1: 160, y1: 160, x2: 250, y2: 100 },
                { x1: 160, y1: 160, x2: 240, y2: 230 },
                { x1: 160, y1: 160, x2: 80, y2: 220 },
              ].map((line, i) => (
                <line
                  key={i}
                  {...line}
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  className="text-border/40"
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Bottom branding */}
        <div
          className={cn(
            "absolute bottom-8 left-8 right-8 transition-all duration-700 delay-700",
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <RiFlashlightLine className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">ANERTiC</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground/70">
            Monitor solar production, grid usage, battery storage, and EV charging — all from one platform.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <RiArrowLeftLine className="size-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <RiFlashlightLine className="size-4 text-primary" />
            <span className="text-sm font-semibold">ANERTiC</span>
          </div>
          <div className="w-16" />
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div
            className={cn(
              "w-full max-w-md space-y-8 transition-all duration-500",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
            )}
          >
            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Create your first site
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                A site represents a physical location you want to monitor — your home, office, or any building with energy devices.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">
                  Site name
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. My Home, Bangkok Office"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm font-medium">
                  Address
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div className="relative">
                  <RiMapPinLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    id="address"
                    placeholder="123 Sukhumvit Rd, Bangkok"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="h-11 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone" className="text-sm font-medium">
                  Timezone
                </Label>
                <div className="relative">
                  <RiTimeLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="flex h-11 w-full appearance-none rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full gap-2"
                  disabled={!name.trim() || creating}
                >
                  {creating ? (
                    "Creating..."
                  ) : (
                    <>
                      Create site
                      <RiArrowRightLine className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Subtle hint */}
            <p className="text-center text-xs text-muted-foreground/60">
              You can add more sites and configure devices after setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
