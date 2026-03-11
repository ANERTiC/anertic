import { useNavigate } from "react-router"
import {
  RiChargingPile2Line,
  RiCpuLine,
  RiArrowRightLine,
  RiAddLine,
  RiLightbulbFlashLine,
  RiBuilding2Line,
  RiSunLine,
  RiPlugLine,
} from "@remixicon/react"
import useSWR from "swr"

import { api } from "~/lib/api"
import { getUser } from "~/lib/auth"
import { setCookie } from "~/lib/cookie"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"

interface Site {
  id: string
  name: string
  address: string
  timezone: string
  createdAt: string
}

interface DashboardSummary {
  totalSites: number
  totalDevices: number
  totalChargers: number
  activeChargers: number
  todayEnergyKwh: number
  todaySolarKwh: number
  todayGridKwh: number
}

const SITE_COLORS = [
  "bg-orange-500",
  "bg-pink-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-purple-500",
]

function getSiteColor(index: number) {
  return SITE_COLORS[index % SITE_COLORS.length]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const user = getUser()

  const { data: sitesData, isLoading: sitesLoading } = useSWR("site.list", () =>
    api<{ items: Site[] }>("site.list"),
  )
  const sites = sitesData?.items || []

  const { data: summary, isLoading: summaryLoading } = useSWR("dashboard.summary", () =>
    api<DashboardSummary>("dashboard.summary"),
  )

  function handleSelectSite(site: Site) {
    setCookie("anertic_current_site", site.id)
    navigate(`/overview?site=${site.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting()}, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening across your sites today.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={RiSunLine}
          title="Solar Production"
          value={summary?.todaySolarKwh}
          unit="kWh"
          loading={summaryLoading}
          color="text-amber-500"
        />
        <SummaryCard
          icon={RiPlugLine}
          title="Grid Usage"
          value={summary?.todayGridKwh}
          unit="kWh"
          loading={summaryLoading}
          color="text-blue-500"
        />
        <SummaryCard
          icon={RiChargingPile2Line}
          title="Active Chargers"
          value={summary?.activeChargers}
          subtitle={summary ? `${summary.totalChargers} total` : undefined}
          loading={summaryLoading}
          color="text-emerald-500"
        />
        <SummaryCard
          icon={RiCpuLine}
          title="Devices"
          value={summary?.totalDevices}
          subtitle={summary ? `${summary.totalSites} sites` : undefined}
          loading={summaryLoading}
          color="text-violet-500"
        />
      </div>

      {/* Energy total */}
      <Card>
        <CardContent className="flex items-center gap-4 py-5">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <RiLightbulbFlashLine className="size-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Energy Today</p>
            {summaryLoading ? (
              <Skeleton className="mt-1 h-8 w-32" />
            ) : (
              <p className="text-3xl font-semibold">
                {summary?.todayEnergyKwh ?? 0}
                <span className="ml-1.5 text-base font-normal text-muted-foreground">
                  kWh
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sites */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Sites
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/sites")}
          >
            <RiAddLine className="mr-1.5 size-3.5" />
            New site
          </Button>
        </div>

        {sitesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <Card
            className="cursor-pointer border-dashed transition-colors hover:bg-muted/50"
            onClick={() => navigate("/sites")}
          >
            <CardContent className="flex flex-col items-center justify-center py-10">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <RiBuilding2Line className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">Create your first site</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start monitoring your energy usage
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site, index) => (
              <Card
                key={site.id}
                className="group cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => handleSelectSite(site)}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white",
                      getSiteColor(index),
                    )}
                  >
                    {site.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{site.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {site.address || site.timezone}
                    </p>
                  </div>
                  <RiArrowRightLine className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  unit,
  subtitle,
  loading,
  color,
}: {
  icon: typeof RiSunLine
  title: string
  value?: number
  unit?: string
  subtitle?: string
  loading: boolean
  color: string
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", color)} />
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-20" />
        ) : (
          <div className="mt-2">
            <p className="text-2xl font-semibold">
              {value ?? 0}
              {unit && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {unit}
                </span>
              )}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}
