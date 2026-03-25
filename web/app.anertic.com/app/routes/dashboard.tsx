import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router'
import {
  RiChargingPile2Line,
  RiCpuLine,
  RiArrowRightLine,
  RiAddLine,
  RiLightbulbFlashLine,
  RiBuilding2Line,
  RiSunLine,
  RiPlugLine,
  RiBattery2ChargeLine,
  RiSparklingLine,
  RiLeafLine,
  RiFlashlightLine,
  RiTimeLine,
} from '@remixicon/react'
import useSWR from 'swr'

import { fetcher } from '~/lib/api'
import type { ConsoleContext } from '~/layouts/console'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'
import { PendingInvites } from '~/components/pending-invites'

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

const SITE_ACCENTS = [
  {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-500',
  },
  {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600',
    ring: 'ring-cyan-500/20',
    dot: 'bg-cyan-500',
  },
  {
    bg: 'bg-violet-500/10',
    text: 'text-violet-600',
    ring: 'ring-violet-500/20',
    dot: 'bg-violet-500',
  },
  {
    bg: 'bg-rose-500/10',
    text: 'text-rose-600',
    ring: 'ring-rose-500/20',
    dot: 'bg-rose-500',
  },
  {
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    ring: 'ring-blue-500/20',
    dot: 'bg-blue-500',
  },
  {
    bg: 'bg-teal-500/10',
    text: 'text-teal-600',
    ring: 'ring-teal-500/20',
    dot: 'bg-teal-500',
  },
  {
    bg: 'bg-orange-500/10',
    text: 'text-orange-600',
    ring: 'ring-orange-500/20',
    dot: 'bg-orange-500',
  },
]

function getSiteAccent(index: number) {
  return SITE_ACCENTS[index % SITE_ACCENTS.length]
}

// --- Mock live power data for the energy flow ---
function useLivePower() {
  const [power, setPower] = useState({
    solar: 4.2,
    grid: 1.8,
    battery: -0.6,
    consumption: 5.4,
    batterySoc: 72,
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setPower((prev) => ({
        solar: Math.max(0, prev.solar + (Math.random() - 0.48) * 0.3),
        grid: Math.max(0, prev.grid + (Math.random() - 0.5) * 0.2),
        battery: prev.battery + (Math.random() - 0.5) * 0.15,
        consumption: Math.max(
          0.5,
          prev.consumption + (Math.random() - 0.5) * 0.2
        ),
        batterySoc: Math.min(
          100,
          Math.max(0, prev.batterySoc + (Math.random() - 0.48) * 0.5)
        ),
      }))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return power
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useOutletContext<ConsoleContext>()
  const power = useLivePower()

  const { data: sitesData, isLoading: sitesLoading } = useSWR<{
    items: Site[]
  }>(['site.list', {}], fetcher)
  const sites = sitesData?.items || []

  const { data: summary, isLoading: summaryLoading } = useSWR<DashboardSummary>(
    ['dashboard.summary', {}],
    fetcher
  )

  // Redirect to sites page if user has no sites
  useEffect(() => {
    if (!sitesLoading && sitesData && sites.length === 0) {
      navigate('/sites/create', { replace: true })
    }
  }, [sitesLoading, sitesData, sites.length, navigate])

  function handleSelectSite(site: Site) {
    navigate(`/overview?site=${site.id}`)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] font-medium tracking-widest text-muted-foreground/60 uppercase sm:text-xs">
          {formatDate()}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
        </h1>
      </div>

      {/* Pending Invitations */}
      <PendingInvites />

      {/* Energy Flow Hero — Desktop */}
      <div className="mb-8 hidden overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 via-background to-primary/5 p-6 sm:block">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiFlashlightLine
              aria-hidden="true"
              className="size-4 text-primary"
            />
            <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Live Energy Flow
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Real-time
          </div>
        </div>

        {/* Flow Diagram */}
        <div className="grid grid-cols-4 gap-3">
          <EnergyNode
            icon={RiSunLine}
            label="Solar"
            value={power.solar}
            unit="kW"
            color="amber"
            direction="producing"
          />
          <EnergyNode
            icon={RiPlugLine}
            label="Grid"
            value={power.grid}
            unit="kW"
            color="cyan"
            direction={power.grid > 0 ? 'importing' : 'exporting'}
          />
          <EnergyNode
            icon={RiBattery2ChargeLine}
            label="Battery"
            value={Math.abs(power.battery)}
            unit="kW"
            color="violet"
            direction={power.battery < 0 ? 'discharging' : 'charging'}
            subtitle={`${Math.round(power.batterySoc)}% SoC`}
          />
          <EnergyNode
            icon={RiLightbulbFlashLine}
            label="Consumption"
            value={power.consumption}
            unit="kW"
            color="rose"
            direction="consuming"
          />
        </div>

        {/* Flow connectors */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <FlowBar from="amber" to="rose" width="40%" label="Solar → Load" />
          <FlowBar from="cyan" to="rose" width="25%" label="Grid → Load" />
          <FlowBar from="violet" to="rose" width="10%" label="Battery → Load" />
        </div>
      </div>

      {/* Energy Flow Hero — Mobile */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 via-background to-primary/5 sm:hidden">
        <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <RiFlashlightLine
              aria-hidden="true"
              className="size-4 text-primary"
            />
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Energy Flow
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </div>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <div className="px-1 text-[9px] font-bold tracking-widest text-muted-foreground/50 uppercase">
            Sources
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MobileFlowNode
              icon={RiSunLine}
              label="Solar"
              value={power.solar}
              unit="kW"
              color="amber"
              status="producing"
            />
            <MobileFlowNode
              icon={RiPlugLine}
              label="Grid"
              value={power.grid}
              unit="kW"
              color="cyan"
              status={power.grid > 0 ? 'importing' : 'exporting'}
            />
          </div>

          <div className="flex justify-center py-0.5">
            <div className="energy-flow-line h-5" />
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-5 py-2.5">
              <RiBattery2ChargeLine
                aria-hidden="true"
                className="size-5 text-violet-600"
              />
              <div>
                <p className="text-base font-bold text-violet-700 tabular-nums">
                  {Math.round(power.batterySoc)}%
                </p>
                <p className="text-[10px] text-violet-600/70">
                  {power.battery < 0 ? '' : '+'}
                  {Math.abs(power.battery).toFixed(1)} kW
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center py-0.5">
            <div className="energy-flow-line h-5" />
          </div>

          <div className="px-1 text-[9px] font-bold tracking-widest text-muted-foreground/50 uppercase">
            Consumption
          </div>
          <div>
            <MobileFlowNode
              icon={RiLightbulbFlashLine}
              label="Load"
              value={power.consumption}
              unit="kW"
              color="rose"
              status="consuming"
            />
          </div>
        </div>
      </div>

      {/* Two columns: Total Energy + AI Insight */}
      <div className="mb-8 grid gap-4 md:grid-cols-5">
        {/* Total Energy */}
        <Card className="overflow-hidden border-border/50 py-0 md:col-span-3">
          <CardContent className="h-full p-0">
            <div className="flex h-full items-stretch">
              <div className="flex-1 p-4 sm:p-5">
                <p className="text-xs font-medium tracking-widest text-muted-foreground/60 uppercase">
                  Total Consumption
                </p>
                {summaryLoading ? (
                  <Skeleton className="mt-3 h-10 w-32 sm:h-12 sm:w-40" />
                ) : (
                  <div className="mt-2">
                    <span className="text-3xl font-bold tracking-tight tabular-nums sm:text-5xl">
                      {summary?.todayEnergyKwh ?? 0}
                    </span>
                    <span className="ml-1.5 text-base font-normal text-muted-foreground sm:ml-2 sm:text-lg">
                      kWh
                    </span>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4">
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full bg-amber-400" />
                    {summary?.todaySolarKwh ?? 0} kWh solar
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full bg-cyan-400" />
                    {summary?.todayGridKwh ?? 0} kWh grid
                  </span>
                </div>
                {/* Mini bar chart */}
                <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
                  <div
                    className="rounded-full bg-amber-400 transition-[width] duration-700"
                    style={{
                      width: `${summary ? (summary.todaySolarKwh / Math.max(summary.todayEnergyKwh, 1)) * 100 : 60}%`,
                    }}
                  />
                  <div className="flex-1 rounded-full bg-cyan-400/60" />
                </div>
              </div>
              {/* Desktop: vertical stats column */}
              <div className="hidden w-px bg-border/50 sm:block" />
              <div
                className="hidden flex-col justify-center gap-3 p-5 sm:flex"
                style={{ minWidth: 160 }}
              >
                <MiniStat
                  label="Devices"
                  value={summary?.totalDevices ?? 0}
                  icon={RiCpuLine}
                />
                <MiniStat
                  label="Sites"
                  value={summary?.totalSites ?? 0}
                  icon={RiBuilding2Line}
                />
                <MiniStat
                  label="Chargers"
                  value={summary?.totalChargers ?? 0}
                  icon={RiChargingPile2Line}
                />
              </div>
            </div>
            {/* Mobile: horizontal stats row */}
            <div className="flex gap-4 border-t border-border/50 px-4 py-3 sm:hidden">
              <MiniStat
                label="Devices"
                value={summary?.totalDevices ?? 0}
                icon={RiCpuLine}
              />
              <MiniStat
                label="Sites"
                value={summary?.totalSites ?? 0}
                icon={RiBuilding2Line}
              />
              <MiniStat
                label="Chargers"
                value={summary?.totalChargers ?? 0}
                icon={RiChargingPile2Line}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Insight */}
        <Card className="border-border/50 bg-gradient-to-br from-primary/5 via-background to-violet-500/5 py-0 md:col-span-2">
          <CardContent className="flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
                <RiSparklingLine
                  aria-hidden="true"
                  className="size-3.5 text-primary"
                />
              </div>
              <span className="text-xs font-semibold tracking-widest text-muted-foreground/60 uppercase">
                AI Insight
              </span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground/80">
              Your solar production peaked at <strong>4.8 kW</strong> today
              between 11:00-13:00. Consider shifting EV charging to midday to
              maximize self-consumption and reduce grid dependency by an
              estimated <strong>18%</strong>.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-xs">
                <RiTimeLine aria-hidden="true" className="size-3" />2 min ago
              </Badge>
              <Badge variant="secondary" className="gap-1 text-xs">
                <RiLeafLine aria-hidden="true" className="size-3" />
                Optimization
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sites */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">Your Sites</h2>
            <p className="truncate text-xs text-muted-foreground">
              {sites.length > 0
                ? `${sites.length} site${sites.length > 1 ? 's' : ''} connected`
                : 'Get started by creating a site'}
            </p>
          </div>
          <Button variant="outline" size="sm" className="min-h-9 shrink-0 gap-1.5" asChild>
            <Link to="/sites/create">
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
              New Site
            </Link>
          </Button>
        </div>

        {sitesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <Link
            to="/sites/create"
            className="group flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-border/60 p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 active:bg-primary/5 sm:gap-5 sm:p-6"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted transition-colors group-hover:bg-primary/10 sm:size-14">
              <RiBuilding2Line
                aria-hidden="true"
                className="size-5 text-muted-foreground transition-colors group-hover:text-primary sm:size-6"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Create your first site</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add a location to start monitoring energy production,
                consumption, and EV charging.
              </p>
            </div>
            <RiArrowRightLine
              aria-hidden="true"
              className="ml-auto hidden size-5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary motion-reduce:transition-none sm:block"
            />
          </Link>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site, index) => (
              <SiteCard
                key={site.id}
                site={site}
                accent={getSiteAccent(index)}
                onSelect={handleSelectSite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function SiteCard({
  site,
  accent,
  onSelect,
}: {
  site: Site
  accent: { bg: string; text: string; ring: string; dot: string }
  onSelect: (site: Site) => void
}) {
  return (
    <button
      onClick={() => onSelect(site)}
      className={cn(
        'group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-border/50 p-3 text-left transition-colors sm:min-h-28 sm:flex-col sm:items-start sm:gap-0 sm:p-5',
        'hover:border-border hover:shadow-md active:bg-muted/50 motion-reduce:transition-none'
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 sm:size-10',
          accent.bg,
          accent.text,
          accent.ring
        )}
      >
        {site.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1 sm:mt-3 sm:flex-none sm:w-full">
        <p className="truncate text-sm font-semibold">{site.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {site.address || site.timezone}
        </p>
      </div>
      <RiArrowRightLine
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/60 motion-reduce:transition-none sm:absolute sm:top-5 sm:right-5"
      />
      {/* Decorative bottom accent */}
      <div
        className={cn(
          'absolute right-5 bottom-0 left-5 h-0.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100',
          accent.dot
        )}
      />
    </button>
  )
}

function EnergyNode({
  icon: Icon,
  label,
  value,
  unit,
  color,
  direction,
  subtitle,
}: {
  icon: typeof RiSunLine
  label: string
  value: number
  unit: string
  color: string
  direction: string
  subtitle?: string
}) {
  const colorMap: Record<string, { bg: string; text: string; glow: string }> = {
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600',
      glow: 'shadow-amber-500/10',
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-600',
      glow: 'shadow-cyan-500/10',
    },
    violet: {
      bg: 'bg-violet-500/10',
      text: 'text-violet-600',
      glow: 'shadow-violet-500/10',
    },
    rose: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-600',
      glow: 'shadow-rose-500/10',
    },
  }
  const c = colorMap[color] || colorMap.amber

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl shadow-lg',
          c.bg,
          c.glow
        )}
      >
        <Icon aria-hidden="true" className={cn('size-5', c.text)} />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
        {value.toFixed(1)}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground/60 capitalize">
        {subtitle || direction}
      </p>
    </div>
  )
}

function FlowBar({
  from,
  to,
  width,
  label,
}: {
  from: string
  to: string
  width: string
  label: string
}) {
  const gradientMap: Record<string, string> = {
    'amber-rose': 'from-amber-400 to-rose-400',
    'cyan-rose': 'from-cyan-400 to-rose-400',
    'violet-rose': 'from-violet-400 to-rose-400',
  }
  const key = `${from}-${to}`
  const gradient = gradientMap[key] || 'from-slate-400 to-slate-600'

  return (
    <div className="flex flex-col items-center gap-1" style={{ width }}>
      <div
        className={cn(
          'h-1.5 w-full rounded-full bg-gradient-to-r opacity-60',
          gradient
        )}
      >
        <div
          className={cn(
            'h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r motion-reduce:animate-none',
            gradient
          )}
          style={{ opacity: 0.9 }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
    </div>
  )
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof RiCpuLine
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon aria-hidden="true" className="size-3.5 text-muted-foreground/50" />
      <div>
        <p className="text-lg leading-none font-bold tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function MobileFlowNode({
  icon: Icon,
  label,
  value,
  unit,
  color,
  status,
}: {
  icon: typeof RiSunLine
  label: string
  value: number
  unit: string
  color: string
  status: string
}) {
  const colors: Record<
    string,
    { bg: string; text: string; icon: string; border: string }
  > = {
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      icon: 'text-amber-500',
      border: 'border-amber-200',
    },
    cyan: {
      bg: 'bg-cyan-50',
      text: 'text-cyan-700',
      icon: 'text-cyan-500',
      border: 'border-cyan-200',
    },
    violet: {
      bg: 'bg-violet-50',
      text: 'text-violet-700',
      icon: 'text-violet-500',
      border: 'border-violet-200',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      icon: 'text-rose-500',
      border: 'border-rose-200',
    },
  }
  const c = colors[color] || colors.amber

  return (
    <div className={cn('rounded-lg border p-3', c.bg, c.border)}>
      <div className="flex items-center gap-1.5">
        <Icon aria-hidden="true" className={cn('size-3.5', c.icon)} />
        <span
          className={cn(
            'text-[10px] font-semibold tracking-wider uppercase opacity-70',
            c.text
          )}
        >
          {label}
        </span>
      </div>
      <p className={cn('mt-1.5 text-lg font-bold tabular-nums', c.text)}>
        {value.toFixed(1)}
        <span className="ml-0.5 text-xs font-normal opacity-60">{unit}</span>
      </p>
      <p className="text-[10px] text-muted-foreground capitalize">{status}</p>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())
}
