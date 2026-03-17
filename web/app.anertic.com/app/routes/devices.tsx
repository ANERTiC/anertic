import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
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
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<DeviceType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ConnectionStatus | "all">("all")

  const { data, isLoading, error, mutate } = useSWR(
    ["device.list", siteId, typeFilter],
    () =>
      api<{ items: DeviceListItem[] }>("device.list", {
        siteId,
        type: typeFilter !== "all" ? typeFilter : undefined,
      }),
  )

  const allDevices = data?.items ?? []

  const devices = useMemo(() => {
    return allDevices.filter((d) => {
      if (statusFilter !== "all" && d.connectionStatus !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          d.name.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          d.tag.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allDevices, statusFilter, search])

  const summary = {
    total: allDevices.length,
    online: allDevices.filter((d) => d.connectionStatus === "online").length,
    degraded: allDevices.filter((d) => d.connectionStatus === "degraded").length,
    offline: allDevices.filter((d) => d.connectionStatus === "offline").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Devices</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Manage device connections, protocols, and API integrations
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => navigate("/devices/new")}>
          <RiAddLine className="size-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Add Device</span>
        </Button>
      </div>

      {/* Connection Summary Strip */}
      <div className="flex items-center gap-6 rounded-xl border border-border/50 bg-muted/20 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <RiLink className="size-4 text-muted-foreground/50" />
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
            onClick={() => setStatusFilter(statusFilter === "online" ? "all" : "online")}
          />
          <SummaryPill
            count={summary.degraded}
            label="Degraded"
            dotClass="bg-amber-500"
            active={statusFilter === "degraded"}
            onClick={() => setStatusFilter(statusFilter === "degraded" ? "all" : "degraded")}
          />
          <SummaryPill
            count={summary.offline}
            label="Offline"
            dotClass="bg-muted-foreground/50"
            active={statusFilter === "offline"}
            onClick={() => setStatusFilter(statusFilter === "offline" ? "all" : "offline")}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Search by name, brand, or model..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                onClick={() => setTypeFilter(isActive ? "all" : type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="size-3.5" />
                {config.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Device List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex w-full items-center gap-4 rounded-xl border border-border/50 p-4"
            >
              <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted/50" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-28 animate-pulse rounded bg-muted/30" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded bg-muted/30" />
              <div className="hidden h-8 w-20 animate-pulse rounded bg-muted/30 sm:block" />
              <div className="h-5 w-20 animate-pulse rounded bg-muted/30" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-destructive/30 py-16">
          <RiCpuLine className="size-8 text-destructive/40" />
          <p className="mt-3 text-sm font-medium text-destructive">Failed to load devices</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => mutate()}>
            <RiRefreshLine className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 py-16">
          <RiCpuLine className="size-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No devices found</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {search || typeFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first device to start monitoring"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              onClick={() => navigate(`/devices/${device.id}?site=${siteId}`)}
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

function DeviceRow({ device, onClick }: { device: DeviceListItem; onClick: () => void }) {
  const typeConfig = DEVICE_TYPE_CONFIG[device.type]
  const TypeIcon = typeConfig.icon
  const statusConfig = STATUS_CONFIG[device.connectionStatus]

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border border-border/50 p-4 text-left transition-all hover:border-border hover:shadow-sm"
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", typeConfig.bg)}>
        <TypeIcon className={cn("size-5", typeConfig.color)} />
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
            <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", statusConfig.dot)} />
          )}
          <span className={cn("relative inline-flex size-2 rounded-full", statusConfig.dot)} />
        </span>
        <div>
          <p className={cn("text-xs font-medium", statusConfig.color)}>{statusConfig.label}</p>
          <p className="text-[10px] text-muted-foreground">{formatLastSeen(device.lastSeenAt)}</p>
        </div>
      </div>
      <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </button>
  )
}
