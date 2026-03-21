import { Link, useSearchParams } from "react-router"
import useSWR from "swr"
import {
  RiAddLine,
  RiSearchLine,
  RiCpuLine,
  RiArrowRightSLine,
  RiLink,
  RiRefreshLine,
} from "@remixicon/react"

import { useSiteId } from "~/layouts/site"
import { api } from "~/lib/api"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Separator } from "~/components/ui/separator"
import { Skeleton } from "~/components/ui/skeleton"
import { cn } from "~/lib/utils"
import {
  DEVICE_TYPE_CONFIG,
  STATUS_CONFIG,
  formatLastSeen,
  type DeviceType,
  type ConnectionStatus,
  type DeviceListItem,
} from "~/lib/device"

// --- Component ---

export default function Devices() {
  const siteId = useSiteId()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get("q") ?? ""
  const typeFilter = (searchParams.get("type") as DeviceType | null) ?? "all"
  const statusFilter = (searchParams.get("status") as ConnectionStatus | null) ?? "all"

  function setFilter(key: string, value: string) {
    setSearchParams((prev) => {
      if (value === "all" || value === "") {
        prev.delete(key)
      } else {
        prev.set(key, value)
      }
      return prev
    }, { replace: true })
  }

  const { data: allData } = useSWR(
    ["device.list", siteId, typeFilter, search],
    () =>
      api<{ items: DeviceListItem[] }>("device.list", {
        siteId,
        type: typeFilter !== "all" ? typeFilter : undefined,
        search: search.trim() || undefined,
      }),
  )

  const allDevices = allData?.items ?? []

  const { data, isLoading, error, mutate } = useSWR(
    ["device.list", siteId, typeFilter, search, statusFilter],
    () =>
      api<{ items: DeviceListItem[] }>("device.list", {
        siteId,
        type: typeFilter !== "all" ? typeFilter : undefined,
        search: search.trim() || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      }),
  )

  const devices = data?.items ?? []

  const summary = {
    total: allDevices.length,
    online: allDevices.filter((d) => d.connectionStatus === "online").length,
    degraded: allDevices.filter((d) => d.connectionStatus === "degraded").length,
    offline: allDevices.filter((d) => d.connectionStatus === "offline").length,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Devices</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Manage device connections, protocols, and API integrations
          </p>
        </div>
        <Button size="sm" className="shrink-0" asChild>
          <Link to={`/devices/new?site=${siteId}`}>
            <RiAddLine data-icon="inline-start" />
            <span className="hidden sm:inline">Add Device</span>
            <span className="sr-only sm:hidden">Add Device</span>
          </Link>
        </Button>
      </div>

      {/* Connection Summary Strip */}
      <div className="flex items-center gap-6 rounded-xl border border-border/50 bg-muted/20 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <RiLink aria-hidden="true" className="size-4 text-muted-foreground/50" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Connections
          </span>
        </div>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-5">
          <SummaryPill count={summary.total} label="Total" dotClass="bg-foreground/30" />
          <SummaryPill
            count={summary.online}
            label="Online"
            dotClass="bg-emerald-500"
            active={statusFilter === "online"}
            onClick={() => setFilter("status", statusFilter === "online" ? "all" : "online")}
          />
          <SummaryPill
            count={summary.degraded}
            label="Degraded"
            dotClass="bg-amber-500"
            active={statusFilter === "degraded"}
            onClick={() => setFilter("status", statusFilter === "degraded" ? "all" : "degraded")}
          />
          <SummaryPill
            count={summary.offline}
            label="Offline"
            dotClass="bg-muted-foreground/50"
            active={statusFilter === "offline"}
            onClick={() => setFilter("status", statusFilter === "offline" ? "all" : "offline")}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <RiSearchLine aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            aria-label="Search devices"
            placeholder="Search by name, brand, or model..."
            className="pl-9"
            value={search}
            onChange={(e) => setFilter("q", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(Object.keys(DEVICE_TYPE_CONFIG) as DeviceType[]).map((type) => {
            const config = DEVICE_TYPE_CONFIG[type]
            const Icon = config.icon
            const isActive = typeFilter === type
            return (
              <button
                key={type}
                onClick={() => setFilter("type", isActive ? "all" : type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {config.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Device List */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex w-full items-center gap-4 rounded-xl border border-border/50 p-4"
            >
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16" />
              <Skeleton className="hidden h-8 w-20 sm:block" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-destructive/30 py-16">
          <RiCpuLine aria-hidden="true" className="size-8 text-destructive/40" />
          <p className="mt-3 text-sm font-medium text-destructive">Failed to load devices</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => mutate()}>
            <RiRefreshLine data-icon="inline-start" />
            Retry
          </Button>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 py-16">
          <RiCpuLine aria-hidden="true" className="size-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No devices found</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {search || typeFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first device to start monitoring"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              href={`/devices/${device.id}?site=${siteId}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function SummaryPill({
  count,
  label,
  dotClass,
  active,
  onClick,
}: {
  count: number
  label: string
  dotClass: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
        onClick && "hover:bg-muted/50",
        active && "bg-foreground/5",
      )}
    >
      <span className={cn("size-2 rounded-full", dotClass)} />
      <span className="text-sm font-bold tabular-nums">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  )
}

function DeviceRow({ device, href }: { device: DeviceListItem; href: string }) {
  const typeConfig = DEVICE_TYPE_CONFIG[device.type]
  const TypeIcon = typeConfig.icon
  const statusConfig = STATUS_CONFIG[device.connectionStatus]

  return (
    <Link
      to={href}
      className="group flex w-full items-center gap-4 rounded-xl border border-border/50 p-4 text-left transition-colors hover:border-border hover:shadow-sm"
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", typeConfig.bg)}>
        <TypeIcon aria-hidden="true" className={cn("size-5", typeConfig.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{device.name}</p>
          {!device.isActive && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Disabled</Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {device.tag || `${device.brand} ${device.model}`}
        </p>
      </div>
      <span className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        {device.meterCount} {device.meterCount === 1 ? "meter" : "meters"}
      </span>
      <div className="flex shrink-0 items-center gap-2" style={{ minWidth: 90 }}>
        <span className="relative flex size-2">
          {device.connectionStatus === "online" && (
            <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:animate-none", statusConfig.dot)} />
          )}
          <span className={cn("relative inline-flex size-2 rounded-full", statusConfig.dot)} />
        </span>
        <div>
          <p className={cn("text-xs font-medium", statusConfig.color)}>{statusConfig.label}</p>
          <p className="text-[10px] text-muted-foreground">{formatLastSeen(device.lastSeenAt)}</p>
        </div>
      </div>
      <RiArrowRightSLine aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/30 transition-transform motion-reduce:transition-none group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  )
}
