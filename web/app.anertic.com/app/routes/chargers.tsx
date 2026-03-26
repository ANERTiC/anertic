import { useState } from 'react'
import { Link } from 'react-router'
import {
  RiAddLine,
  RiChargingPile2Line,
  RiChargingPileLine,
  RiSearchLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiFlashlightLine,
  RiTimeLine,
  RiPlugLine,
  RiLoopLeftLine,
  RiAlertLine,
  RiArrowRightSLine,
} from '@remixicon/react'
import useSWR from 'swr'

import { useSiteId } from '~/layouts/site'
import { fetcher } from '~/lib/api'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import { cn } from '~/lib/utils'

// --- Types ---

interface ConnectorStatus {
  id: number
  status: string
  errorCode: string
  connectorType: string
  maxPowerKw: string
  powerKw: string
  lastStatusAt: string | null
  vehicleId: string | null
  sessionStartedAt: string | null
  sessionKwh: string
}

interface Charger {
  id: string
  siteId: string
  chargePointId: string
  ocppVersion: string
  status: string
  registrationStatus: string
  connectorCount: number
  maxPowerKw: string
  vendor: string
  model: string
  serialNumber: string
  firmwareVersion: string
  lastHeartbeatAt: string | null
  createdAt: string
  currentPowerKw: string
  todayEnergyKwh: string
  todaySessions: number
  connectors: ConnectorStatus[] | null
}

interface ListResult {
  items: Charger[]
}

interface FleetSummary {
  total: number
  charging: number
  available: number
  faulted: number
  offline: number
  totalPowerKw: number
  maxCapacityKw: number
  todayEnergyKwh: number
  todaySessions: number
  avgSessionKwh: number
  utilizationPercent: number
}

// --- Helpers ---

function computeFleetSummary(chargers: Charger[]): FleetSummary {
  const charging = chargers.filter(
    (c) => c.status === 'Charging' || c.status === 'Preparing'
  ).length
  const available = chargers.filter((c) => c.status === 'Available').length
  const faulted = chargers.filter((c) => c.status === 'Faulted').length
  const offline = chargers.filter((c) => !c.lastHeartbeatAt).length
  const totalPowerKw = chargers.reduce((s, c) => s + (Number(c.currentPowerKw) || 0), 0)
  const maxCapacityKw = chargers.reduce((s, c) => s + (Number(c.maxPowerKw) || 0), 0)
  const todayEnergyKwh = chargers.reduce((s, c) => s + (Number(c.todayEnergyKwh) || 0), 0)
  const todaySessions = chargers.reduce((s, c) => s + (c.todaySessions || 0), 0)

  return {
    total: chargers.length,
    charging,
    available,
    faulted,
    offline,
    totalPowerKw,
    maxCapacityKw,
    todayEnergyKwh,
    todaySessions,
    avgSessionKwh: todaySessions > 0 ? todayEnergyKwh / todaySessions : 0,
    utilizationPercent:
      maxCapacityKw > 0 ? (totalPowerKw / maxCapacityKw) * 100 : 0,
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'Available':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
    case 'Charging':
    case 'Preparing':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
    case 'SuspendedEV':
    case 'SuspendedEVSE':
    case 'Finishing':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
    case 'Faulted':
      return 'bg-red-500/15 text-red-700 dark:text-red-400'
    case 'Reserved':
      return 'bg-purple-500/15 text-purple-700 dark:text-purple-400'
    default:
      return 'bg-gray-500/15 text-gray-700 dark:text-gray-400'
  }
}

function statusDot(status: string) {
  switch (status) {
    case 'Available':
      return 'bg-emerald-500'
    case 'Charging':
    case 'Preparing':
      return 'bg-blue-500'
    case 'SuspendedEV':
    case 'SuspendedEVSE':
    case 'Finishing':
      return 'bg-amber-500'
    case 'Faulted':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatPower(kw: number): string {
  if (kw >= 100) return `${Math.round(kw)} kW`
  if (kw >= 10) return `${kw.toFixed(1)} kW`
  return `${kw.toFixed(2)} kW`
}

function formatEnergy(kwh: number): string {
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(1)} MWh`
  if (kwh >= 100) return `${Math.round(kwh)} kWh`
  return `${kwh.toFixed(1)} kWh`
}

function sessionDuration(startedAt: string | null | undefined): string {
  if (!startedAt) return ''
  const diff = Date.now() - new Date(startedAt).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

// --- Main Component ---

export default function Chargers() {
  const siteId = useSiteId()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const { data, isLoading } = useSWR<ListResult>(
    siteId ? ['charger.list', { siteId }] : null,
    fetcher,
    {
      refreshInterval: 15000,
    }
  )

  const chargers = data?.items || []

  const filtered = chargers.filter((c) => {
    const matchesSearch =
      !search ||
      c.chargePointId.toLowerCase().includes(search.toLowerCase()) ||
      c.vendor.toLowerCase().includes(search.toLowerCase()) ||
      c.model.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'Charging' &&
        (c.status === 'Charging' || c.status === 'Preparing')) ||
      (statusFilter === 'Faulted' && c.status === 'Faulted') ||
      (statusFilter === 'Available' && c.status === 'Available') ||
      (statusFilter === 'Other' &&
        !['Charging', 'Preparing', 'Faulted', 'Available'].includes(c.status))

    return matchesSearch && matchesStatus
  })

  const fleet = computeFleetSummary(chargers)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-8 w-28 shrink-0" />
        </div>

        {/* Fleet strip skeleton */}
        <Card className="overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-3.5 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charger card skeletons */}
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3.5 w-40" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <div className="flex justify-between border-t pt-3">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Chargers
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Fleet management and monitoring
          </p>
        </div>
        <Button size="sm" className="shrink-0" asChild>
          <Link to={`/chargers/new?site=${siteId}`}>
            <RiAddLine aria-hidden="true" data-icon="inline-start" />
            <span className="hidden sm:inline">Add Charger</span>
            <span className="sr-only sm:hidden">Add Charger</span>
          </Link>
        </Button>
      </div>

      {/* Fleet Summary Strip */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-6">
            <FleetCell
              icon={RiFlashlightLine}
              label="Live Power"
              value={formatPower(fleet.totalPowerKw)}
              sub={`of ${formatPower(fleet.maxCapacityKw)} capacity`}
              color="cyan"
            />
            <FleetCell
              icon={RiChargingPile2Line}
              label="Today"
              value={formatEnergy(fleet.todayEnergyKwh)}
              sub={`${fleet.todaySessions} sessions`}
              color="amber"
            />
            <FleetCell
              icon={RiLoopLeftLine}
              label="Utilization"
              value={`${fleet.utilizationPercent.toFixed(0)}%`}
              sub={`${fleet.charging} of ${fleet.total} active`}
              color="violet"
            />
            <FleetCell
              icon={RiChargingPileLine}
              label="Available"
              value={String(fleet.available)}
              sub="ready to charge"
              color="emerald"
            />
            <FleetCell
              icon={RiAlertLine}
              label="Faulted"
              value={String(fleet.faulted)}
              sub={fleet.faulted > 0 ? 'needs attention' : 'all healthy'}
              color={fleet.faulted > 0 ? 'red' : 'emerald'}
            />
            <FleetCell
              icon={RiPlugLine}
              label="Avg Session"
              value={`${fleet.avgSessionKwh.toFixed(1)} kWh`}
              sub="per charge"
              color="blue"
            />
          </div>
        </CardContent>
      </Card>

      {/* Search + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <RiSearchLine
            aria-hidden="true"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search chargers"
            placeholder="Search chargers..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {[
            { label: 'All', value: null, count: fleet.total },
            { label: 'Charging', value: 'Charging', count: fleet.charging },
            { label: 'Available', value: 'Available', count: fleet.available },
            { label: 'Faulted', value: 'Faulted', count: fleet.faulted },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Charger Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <RiChargingPileLine
            aria-hidden="true"
            className="mb-3 size-10 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter
              ? 'No chargers match your filters'
              : 'No chargers registered yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((charger) => (
            <ChargerCard
              key={charger.id}
              charger={charger}
              href={`/chargers/${charger.id}?site=${siteId}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function FleetCell({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof RiFlashlightLine
  label: string
  value: string
  sub: string
  color: string
}) {
  const colorMap: Record<string, { text: string; bg: string }> = {
    amber: { text: 'text-amber-700', bg: 'from-amber-50' },
    emerald: { text: 'text-emerald-700', bg: 'from-emerald-50' },
    violet: { text: 'text-violet-700', bg: 'from-violet-50' },
    blue: { text: 'text-blue-700', bg: 'from-blue-50' },
    cyan: { text: 'text-cyan-700', bg: 'from-cyan-50' },
    red: { text: 'text-red-700', bg: 'from-red-50' },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="relative px-4 py-3.5">
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br to-transparent',
          c.bg
        )}
      />
      <div className="relative">
        <div
          className={cn(
            'flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase opacity-70',
            c.text
          )}
        >
          <Icon aria-hidden="true" className="size-3" />
          {label}
        </div>
        <p
          className={cn(
            'mt-1.5 text-lg font-bold tracking-tight tabular-nums',
            c.text
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function ChargerCard({ charger, href }: { charger: Charger; href: string }) {
  const isCharging =
    charger.status === 'Charging' || charger.status === 'Preparing'
  const isFaulted = charger.status === 'Faulted'
  const isOnline = !!charger.lastHeartbeatAt
  const connectors = charger.connectors || []

  return (
    <Link
      to={href}
      className={cn(
        'group block h-full overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-colors hover:shadow-md',
        isFaulted && 'border-red-200'
      )}
    >
      <div className="flex h-full flex-col p-4">
        {/* Top row */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                {isCharging && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75 motion-reduce:animate-none" />
                )}
                {isFaulted && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
                )}
                <span
                  className={cn(
                    'relative inline-flex size-2.5 rounded-full',
                    statusDot(charger.status)
                  )}
                />
              </span>
              <h3 className="text-base font-semibold tracking-tight">
                {charger.chargePointId}
              </h3>
              <Badge className={cn('text-[10px]', statusColor(charger.status))}>
                {charger.status}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {charger.vendor} {charger.model}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isOnline ? (
                <RiSignalWifiLine
                  aria-hidden="true"
                  className="size-3 text-emerald-500"
                />
              ) : (
                <RiSignalWifiOffLine
                  aria-hidden="true"
                  className="size-3 text-red-400"
                />
              )}
              <span className="tabular-nums">
                {timeAgo(charger.lastHeartbeatAt)}
              </span>
            </div>
            <RiArrowRightSLine
              aria-hidden="true"
              className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
        </div>

        {/* Connectors */}
        <div className="mt-3 flex flex-1 flex-col gap-2">
          {connectors.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              <RiPlugLine aria-hidden="true" className="size-4" />
              No connectors registered
            </div>
          ) : (
            connectors.map((conn) => (
              <ConnectorRow key={conn.id} connector={conn} />
            ))
          )}
        </div>

        {/* Bottom stats */}
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 tabular-nums">
              <RiFlashlightLine aria-hidden="true" className="size-3" />
              {formatEnergy(Number(charger.todayEnergyKwh) || 0)} today
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <RiLoopLeftLine aria-hidden="true" className="size-3" />
              {charger.todaySessions || 0} sessions
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="tabular-nums">OCPP {charger.ocppVersion}</span>
            <span>&middot;</span>
            <span className="tabular-nums">{charger.maxPowerKw} kW</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ConnectorRow({ connector }: { connector: ConnectorStatus }) {
  const isActive =
    connector.status === 'Charging' || connector.status === 'Preparing'
  const isSuspended =
    connector.status === 'SuspendedEV' || connector.status === 'SuspendedEVSE'
  const isFaulted = connector.status === 'Faulted'

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2',
        isActive && 'border-blue-200 bg-blue-50/50',
        isSuspended && 'border-amber-200 bg-amber-50/30',
        isFaulted && 'border-red-200 bg-red-50/30'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <RiPlugLine
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-white',
              statusDot(connector.status)
            )}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          #{connector.id}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {connector.vehicleId ? (
          <p className="truncate text-xs font-medium">{connector.vehicleId}</p>
        ) : isFaulted && connector.errorCode ? (
          <p className="truncate text-xs font-medium text-red-600">
            {connector.errorCode}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {connector.status === 'Available' ? 'Ready' : connector.status}
          </p>
        )}
      </div>

      {isActive && (
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="font-semibold text-blue-700">
            {formatPower(Number(connector.powerKw))}
          </span>
          <span className="text-muted-foreground">
            {Number(connector.sessionKwh).toFixed(1)} kWh
          </span>
        </div>
      )}
      {isSuspended && Number(connector.sessionKwh) > 0 && (
        <div className="flex items-center gap-2 text-xs tabular-nums">
          <span className="text-amber-600">Paused</span>
          <span className="text-muted-foreground">
            {Number(connector.sessionKwh).toFixed(1)} kWh
          </span>
        </div>
      )}
      {connector.sessionStartedAt && (isActive || isSuspended) && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <RiTimeLine aria-hidden="true" className="size-3" />
          {sessionDuration(connector.sessionStartedAt)}
        </span>
      )}
    </div>
  )
}
