import { useState } from "react"
import { useNavigate, Link } from "react-router"
import {
  RiAddLine,
  RiSearchLine,
  RiCpuLine,
  RiSunLine,
  RiPlugLine,
  RiArrowRightSLine,
  RiRefreshLine,
  RiLink,
  RiFlashlightLine,
} from "@remixicon/react"

import { useSiteId } from "~/layouts/site"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
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
  brand: string
  model: string
  isActive: boolean
  protocol: Protocol
  connectionStatus: ConnectionStatus
  lastSeenAt: string | null
  ipAddress: string | null
  firmwareVersion: string | null
  apiKeyPrefix: string | null
  dataPointsToday: number
  uptimePercent: number
  createdAt: string
}

type DeviceType = "inverter" | "solar_panel" | "appliance" | "meter"
type Protocol = "mqtt" | "rest"
type ConnectionStatus = "online" | "offline" | "degraded"

// --- Mock Data ---

const MOCK_DEVICES: Device[] = [
  {
    id: "dev_01",
    siteId: "site_01",
    name: "Main Inverter",
    type: "inverter",
    brand: "SMA",
    model: "Sunny Tripower 10.0",
    isActive: true,
    protocol: "mqtt",
    connectionStatus: "online",
    lastSeenAt: new Date(Date.now() - 15000).toISOString(),
    ipAddress: "192.168.1.40",
    firmwareVersion: "3.10.18.R",
    apiKeyPrefix: "anertic_inv_",
    dataPointsToday: 2847,
    uptimePercent: 99.8,
    createdAt: "2025-08-15T10:00:00Z",
  },
  {
    id: "dev_02",
    siteId: "site_01",
    name: "Roof Array East",
    type: "solar_panel",
    brand: "JA Solar",
    model: "JAM72S30-545/MR",
    isActive: true,
    protocol: "mqtt",
    connectionStatus: "online",
    lastSeenAt: new Date(Date.now() - 8000).toISOString(),
    ipAddress: null,
    firmwareVersion: null,
    apiKeyPrefix: "anertic_sol_",
    dataPointsToday: 1420,
    uptimePercent: 99.2,
    createdAt: "2025-08-15T10:30:00Z",
  },
  {
    id: "dev_03",
    siteId: "site_01",
    name: "Grid Meter",
    type: "meter",
    brand: "Eastron",
    model: "SDM630",
    isActive: true,
    protocol: "rest",
    connectionStatus: "online",
    lastSeenAt: new Date(Date.now() - 5000).toISOString(),
    ipAddress: "192.168.1.41",
    firmwareVersion: "1.037",
    apiKeyPrefix: "anertic_mtr_",
    dataPointsToday: 4320,
    uptimePercent: 100,
    createdAt: "2025-08-15T09:00:00Z",
  },
  {
    id: "dev_04",
    siteId: "site_01",
    name: "Battery Storage",
    type: "appliance",
    brand: "BYD",
    model: "Battery-Box Premium HVS",
    isActive: true,
    protocol: "mqtt",
    connectionStatus: "degraded",
    lastSeenAt: new Date(Date.now() - 180000).toISOString(),
    ipAddress: null,
    firmwareVersion: "2.4.1",
    apiKeyPrefix: "anertic_bat_",
    dataPointsToday: 890,
    uptimePercent: 87.3,
    createdAt: "2025-09-01T14:00:00Z",
  },
  {
    id: "dev_05",
    siteId: "site_01",
    name: "Roof Array West",
    type: "solar_panel",
    brand: "JA Solar",
    model: "JAM72S30-545/MR",
    isActive: true,
    protocol: "mqtt",
    connectionStatus: "online",
    lastSeenAt: new Date(Date.now() - 12000).toISOString(),
    ipAddress: null,
    firmwareVersion: null,
    apiKeyPrefix: "anertic_sol_",
    dataPointsToday: 1380,
    uptimePercent: 98.9,
    createdAt: "2025-08-16T08:00:00Z",
  },
  {
    id: "dev_06",
    siteId: "site_01",
    name: "HVAC Controller",
    type: "appliance",
    brand: "Daikin",
    model: "BRP069C4x",
    isActive: false,
    protocol: "rest",
    connectionStatus: "offline",
    lastSeenAt: new Date(Date.now() - 86400000).toISOString(),
    ipAddress: "192.168.1.55",
    firmwareVersion: "1.2.68",
    apiKeyPrefix: "anertic_hvc_",
    dataPointsToday: 0,
    uptimePercent: 0,
    createdAt: "2025-10-05T16:00:00Z",
  },
  {
    id: "dev_07",
    siteId: "site_01",
    name: "Solar Meter",
    type: "meter",
    brand: "Eastron",
    model: "SDM120",
    isActive: true,
    protocol: "mqtt",
    connectionStatus: "online",
    lastSeenAt: new Date(Date.now() - 3000).toISOString(),
    ipAddress: "192.168.1.42",
    firmwareVersion: "1.031",
    apiKeyPrefix: "anertic_mtr_",
    dataPointsToday: 4310,
    uptimePercent: 100,
    createdAt: "2025-08-15T09:15:00Z",
  },
]

const DEVICE_TYPE_CONFIG: Record<
  DeviceType,
  { label: string; icon: typeof RiCpuLine; color: string; bg: string }
> = {
  inverter: { label: "Inverter", icon: RiFlashlightLine, color: "text-violet-600", bg: "bg-violet-500/10" },
  solar_panel: { label: "Solar Panel", icon: RiSunLine, color: "text-amber-600", bg: "bg-amber-500/10" },
  meter: { label: "Meter", icon: RiCpuLine, color: "text-cyan-600", bg: "bg-cyan-500/10" },
  appliance: { label: "Appliance", icon: RiPlugLine, color: "text-emerald-600", bg: "bg-emerald-500/10" },
}

const PROTOCOL_CONFIG: Record<Protocol, { label: string; color: string }> = {
  mqtt: { label: "MQTT", color: "text-purple-700 bg-purple-500/10" },
  rest: { label: "REST API", color: "text-blue-700 bg-blue-500/10" },
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

  const devices = MOCK_DEVICES.filter((d) => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false
    if (statusFilter !== "all" && d.connectionStatus !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q)
      )
    }
    return true
  })

  const summary = {
    total: MOCK_DEVICES.length,
    online: MOCK_DEVICES.filter((d) => d.connectionStatus === "online").length,
    degraded: MOCK_DEVICES.filter((d) => d.connectionStatus === "degraded").length,
    offline: MOCK_DEVICES.filter((d) => d.connectionStatus === "offline").length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
          <p className="text-sm text-muted-foreground">
            Manage device connections, protocols, and API integrations
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => navigate("/devices/new")}>
          <RiAddLine className="size-4" />
          Add device
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
      {devices.length === 0 ? (
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
  const protocolConfig = PROTOCOL_CONFIG[device.protocol]

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
          {device.brand} {device.model}
        </p>
      </div>
      <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold", protocolConfig.color)}>
        {protocolConfig.label}
      </span>
      <div className="hidden shrink-0 text-right sm:block" style={{ minWidth: 80 }}>
        <p className="text-xs font-semibold tabular-nums">{device.dataPointsToday.toLocaleString()}</p>
        <p className="text-[10px] text-muted-foreground">points today</p>
      </div>
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
  const protocolConfig = PROTOCOL_CONFIG[device.protocol]

  return (
    <div>
      <div className="flex items-start gap-4 p-6 pb-4">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", typeConfig.bg)}>
          <TypeIcon className={cn("size-6", typeConfig.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold tracking-tight">{device.name}</h3>
          <p className="text-sm text-muted-foreground">{device.brand} {device.model}</p>
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
            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", protocolConfig.color)}>
              {protocolConfig.label}
            </span>
          </div>
        </div>
      </div>
      <Separator />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-3 gap-3">
          <MetricBox
            label="Uptime"
            value={`${device.uptimePercent}%`}
            color={device.uptimePercent >= 99 ? "text-emerald-600" : device.uptimePercent >= 90 ? "text-amber-600" : "text-red-600"}
          />
          <MetricBox label="Data Points" value={device.dataPointsToday.toLocaleString()} color="text-foreground" />
          <MetricBox
            label="Last Seen"
            value={formatLastSeen(device.lastSeenAt)}
            color={device.connectionStatus === "online" ? "text-emerald-600" : "text-muted-foreground"}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono">{device.id}</span>
          {device.ipAddress && <span className="ml-3">{device.ipAddress}</span>}
          {device.firmwareVersion && <span className="ml-3">v{device.firmwareVersion}</span>}
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-between p-4 px-6">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <RiRefreshLine className="size-3.5" />
          Ping
        </Button>
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
