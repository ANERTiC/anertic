import { useState, useEffect, useCallback } from "react"
import { useNavigate, Link } from "react-router"
import {
  RiAddLine,
  RiSearchLine,
  RiCpuLine,
  RiSunLine,
  RiPlugLine,
  RiArrowRightSLine,
  RiLink,
  RiFlashlightLine,
  RiLoader4Line,
} from "@remixicon/react"

import { useSiteId } from "~/layouts/site"
import { api } from "~/lib/api"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Dialog, DialogContent } from "~/components/ui/dialog"
import { Separator } from "~/components/ui/separator"
import { cn } from "~/lib/utils"

// --- Types ---

interface Device {
  id: string
  siteId: string
  name: string
  type: DeviceType
  tag: string
  brand: string
  model: string
  isActive: boolean
  connectionStatus: ConnectionStatus
  lastSeenAt: string | null
  meterCount: number
  createdAt: string
}

type DeviceType = "inverter" | "solar_panel" | "appliance" | "meter"
type ConnectionStatus = "online" | "offline" | "degraded"

const DEVICE_TYPE_CONFIG: Record<
  DeviceType,
  { label: string; icon: typeof RiCpuLine; color: string; bg: string }
> = {
  inverter: { label: "Inverter", icon: RiFlashlightLine, color: "text-violet-600", bg: "bg-violet-500/10" },
  solar_panel: { label: "Solar Panel", icon: RiSunLine, color: "text-amber-600", bg: "bg-amber-500/10" },
  meter: { label: "Meter", icon: RiCpuLine, color: "text-cyan-600", bg: "bg-cyan-500/10" },
  appliance: { label: "Appliance", icon: RiPlugLine, color: "text-emerald-600", bg: "bg-emerald-500/10" },
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; dot: string }> = {
  online: { label: "Online", color: "text-emerald-700", dot: "bg-emerald-500" },
  offline: { label: "Offline", color: "text-muted-foreground", dot: "bg-muted-foreground/50" },
  degraded: { label: "Degraded", color: "text-amber-700", dot: "bg-amber-500" },
}

// --- Component ---

export default function Devices() {
  const siteId = useSiteId()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<DeviceType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<ConnectionStatus | "all">("all")
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [allDevices, setAllDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = { siteId }
      if (typeFilter !== "all") params.type = typeFilter
      if (search.trim()) params.search = search.trim()
      const res = await api<{ items: Device[] }>("device.list", params)
      setAllDevices(res.items ?? [])
    } catch {
      setAllDevices([])
    } finally {
      setLoading(false)
    }
  }, [siteId, typeFilter, search])

  useEffect(() => {
    const timer = setTimeout(fetchDevices, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [fetchDevices, search])

  const devices = statusFilter === "all"
    ? allDevices
    : allDevices.filter((d) => d.connectionStatus === statusFilter)

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
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <RiLoader4Line className="size-6 animate-spin text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Loading devices...</p>
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
              onClick={() => setSelectedDevice(device)}
            />
          ))}
        </div>
      )}

      {/* Device Quick View Dialog */}
      <Dialog
        open={selectedDevice !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDevice(null)
        }}
      >
        {selectedDevice && (
          <DialogContent className="max-w-md gap-0 p-0">
            <DeviceQuickView device={selectedDevice} />
          </DialogContent>
        )}
      </Dialog>
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

function DeviceRow({ device, onClick }: { device: Device; onClick: () => void }) {
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

function DeviceQuickView({ device }: { device: Device }) {
  const typeConfig = DEVICE_TYPE_CONFIG[device.type]
  const TypeIcon = typeConfig.icon
  const statusConfig = STATUS_CONFIG[device.connectionStatus]

  return (
    <div>
      <div className="flex items-start gap-4 p-6 pb-4">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", typeConfig.bg)}>
          <TypeIcon className={cn("size-6", typeConfig.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight">{device.name}</h3>
          <p className="text-sm text-muted-foreground">{device.brand} {device.model}</p>
          {device.tag && (
            <p className="mt-0.5 text-xs text-muted-foreground/60">{device.tag}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                {device.connectionStatus === "online" && (
                  <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", statusConfig.dot)} />
                )}
                <span className={cn("relative inline-flex size-2 rounded-full", statusConfig.dot)} />
              </span>
              <span className={cn("text-xs font-medium", statusConfig.color)}>{statusConfig.label}</span>
            </div>
            <span className="rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {device.meterCount} {device.meterCount === 1 ? "meter" : "meters"}
            </span>
          </div>
        </div>
      </div>
      <Separator />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3">
          <MetricBox label="Meters" value={String(device.meterCount)} color="text-foreground" />
          <MetricBox
            label="Last Seen"
            value={formatLastSeen(device.lastSeenAt)}
            color={device.connectionStatus === "online" ? "text-emerald-600" : "text-muted-foreground"}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{device.id}</span>
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-end p-4 px-6">
        <Link to={`/devices/${device.id}`}>
          <Button size="sm" className="gap-1.5 text-xs">
            View details
            <RiArrowRightSLine className="size-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  )
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className={cn("mt-1 text-sm font-bold tabular-nums", color)}>{value}</p>
    </div>
  )
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never"
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
