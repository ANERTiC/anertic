import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import {
  RiArrowLeftLine,
  RiCpuLine,
  RiSunLine,
  RiPlugLine,
  RiFlashlightLine,
  RiSignalWifiOffLine,
  RiSettings3Line,
  RiRefreshLine,
  RiClipboardLine,
  RiEditLine,
  RiDeleteBinLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiBarChartBoxLine,
  RiLink,
  RiAddLine,
  RiSensorLine,
  RiWifiLine,
  RiArrowRightSLine,
  RiDashboard3Line,
  RiPulseLine,
  RiCloseLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { useSiteId } from "~/layouts/site"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Dialog, DialogContent } from "~/components/ui/dialog"
import { cn } from "~/lib/utils"

// --- Types ---

type DeviceType = "inverter" | "solar_panel" | "appliance" | "meter"
type MeterProtocol = "mqtt" | "http" | "modbus"
type ConnectionStatus = "online" | "offline" | "degraded"
type MeterSubtype = "main_db" | "floor_sub_db" | "electrical_device"

interface Device {
  id: string
  siteId: string
  name: string
  type: DeviceType
  subtype: MeterSubtype | null
  tag: string | null
  brand: string
  model: string
  isActive: boolean
  createdAt: string
}

interface Meter {
  id: string
  deviceId: string
  serialNumber: string
  protocol: MeterProtocol
  vendor: string
  isOnline: boolean
  lastSeenAt: string | null
  config: Record<string, string>
  createdAt: string
  latestReadings: MeterReading[]
}

interface MeterReading {
  metric: string
  value: number
  unit: string
  timestamp: string
}

interface EventLog {
  id: string
  timestamp: string
  source: "device" | "meter"
  sourceName: string
  type: "connected" | "disconnected" | "error" | "config_changed" | "data_received"
  message: string
}

// --- Config ---

const DEVICE_TYPE_CONFIG: Record<
  DeviceType,
  { label: string; icon: typeof RiCpuLine; color: string; bg: string }
> = {
  inverter: { label: "Inverter", icon: RiFlashlightLine, color: "text-violet-600", bg: "bg-violet-500/10" },
  solar_panel: { label: "Solar Panel", icon: RiSunLine, color: "text-amber-600", bg: "bg-amber-500/10" },
  meter: { label: "Energy Meter", icon: RiDashboard3Line, color: "text-cyan-600", bg: "bg-cyan-500/10" },
  appliance: { label: "Appliance", icon: RiPlugLine, color: "text-emerald-600", bg: "bg-emerald-500/10" },
}

const SUBTYPE_CONFIG: Record<MeterSubtype, { label: string }> = {
  main_db: { label: "Main DB" },
  floor_sub_db: { label: "Floor Sub-DB" },
  electrical_device: { label: "Electrical Device" },
}

const PROTOCOL_CONFIG: Record<MeterProtocol, { label: string; color: string; bg: string; icon: typeof RiWifiLine }> = {
  mqtt: { label: "MQTT", color: "text-purple-700", bg: "bg-purple-500/10", icon: RiWifiLine },
  http: { label: "HTTP", color: "text-blue-700", bg: "bg-blue-500/10", icon: RiLink },
  modbus: { label: "Modbus", color: "text-orange-700", bg: "bg-orange-500/10", icon: RiPulseLine },
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; dot: string }> = {
  online: { label: "Online", color: "text-emerald-700", dot: "bg-emerald-500" },
  offline: { label: "Offline", color: "text-muted-foreground", dot: "bg-muted-foreground/50" },
  degraded: { label: "Degraded", color: "text-amber-700", dot: "bg-amber-500" },
}

// --- Mock Data ---

function getMockDevice(id: string): Device {
  return {
    id,
    siteId: "site_01",
    name: "Grid Meter",
    type: "meter",
    subtype: "main_db",
    tag: "Main grid import/export",
    brand: "Eastron",
    model: "SDM630-Modbus V2",
    isActive: true,
    createdAt: "2025-08-15T09:00:00Z",
  }
}

function getMockMeters(deviceId: string): Meter[] {
  return [
    {
      id: "mtr_01",
      deviceId,
      serialNumber: "SDM-2030-4821",
      protocol: "modbus",
      vendor: "Eastron",
      isOnline: true,
      lastSeenAt: new Date(Date.now() - 5000).toISOString(),
      config: {
        address: "192.168.1.41",
        port: "502",
        slave_id: "1",
        baud_rate: "9600",
        register_map: "eastron_sdm630",
      },
      createdAt: "2025-08-15T09:00:00Z",
      latestReadings: [
        { metric: "power_w", value: 2847.5, unit: "W", timestamp: new Date(Date.now() - 5000).toISOString() },
        { metric: "energy_kwh", value: 12483.2, unit: "kWh", timestamp: new Date(Date.now() - 5000).toISOString() },
        { metric: "voltage_v", value: 232.1, unit: "V", timestamp: new Date(Date.now() - 5000).toISOString() },
        { metric: "current_a", value: 12.27, unit: "A", timestamp: new Date(Date.now() - 5000).toISOString() },
        { metric: "frequency", value: 50.01, unit: "Hz", timestamp: new Date(Date.now() - 5000).toISOString() },
        { metric: "pf", value: 0.98, unit: "", timestamp: new Date(Date.now() - 5000).toISOString() },
      ],
    },
    {
      id: "mtr_02",
      deviceId,
      serialNumber: "SDM-2030-4822",
      protocol: "mqtt",
      vendor: "Eastron",
      isOnline: true,
      lastSeenAt: new Date(Date.now() - 8000).toISOString(),
      config: {
        broker: "mqtt://broker.anertic.com:1883",
        topic: "meters/mtr_02/telemetry",
        qos: "1",
      },
      createdAt: "2025-09-01T10:30:00Z",
      latestReadings: [
        { metric: "power_w", value: 1523.8, unit: "W", timestamp: new Date(Date.now() - 8000).toISOString() },
        { metric: "energy_kwh", value: 5841.7, unit: "kWh", timestamp: new Date(Date.now() - 8000).toISOString() },
        { metric: "voltage_v", value: 231.8, unit: "V", timestamp: new Date(Date.now() - 8000).toISOString() },
        { metric: "current_a", value: 6.57, unit: "A", timestamp: new Date(Date.now() - 8000).toISOString() },
      ],
    },
  ]
}

const MOCK_EVENTS: EventLog[] = [
  { id: "e1", timestamp: new Date(Date.now() - 5000).toISOString(), source: "meter", sourceName: "SDM-2030-4821", type: "data_received", message: "Telemetry batch received (6 readings)" },
  { id: "e2", timestamp: new Date(Date.now() - 8000).toISOString(), source: "meter", sourceName: "SDM-2030-4822", type: "data_received", message: "Telemetry batch received (4 readings)" },
  { id: "e3", timestamp: new Date(Date.now() - 300000).toISOString(), source: "meter", sourceName: "SDM-2030-4821", type: "connected", message: "Meter reconnected via Modbus TCP" },
  { id: "e4", timestamp: new Date(Date.now() - 360000).toISOString(), source: "meter", sourceName: "SDM-2030-4821", type: "disconnected", message: "Connection lost — timeout after 30s" },
  { id: "e5", timestamp: new Date(Date.now() - 3600000).toISOString(), source: "device", sourceName: "Grid Meter", type: "config_changed", message: "Device tag updated" },
]

// --- Component ---

export default function DeviceDetail() {
  const navigate = useNavigate()
  const { deviceId } = useParams()
  const [expandedMeter, setExpandedMeter] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showEvents, setShowEvents] = useState(false)

  const device = getMockDevice(deviceId || "dev_01")
  const meters = getMockMeters(device.id)
  const typeConfig = DEVICE_TYPE_CONFIG[device.type]
  const TypeIcon = typeConfig.icon

  const onlineMeters = meters.filter((m) => m.isOnline).length

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/devices")}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <RiArrowLeftLine className="size-4" />
          Back to devices
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", typeConfig.bg)}>
              <TypeIcon className={cn("size-7", typeConfig.color)} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{device.name}</h1>
                {!device.isActive && <Badge variant="secondary">Disabled</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {device.brand} {device.model}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {typeConfig.label}
                </Badge>
                {device.subtype && (
                  <Badge variant="outline" className="text-[10px]">
                    {SUBTYPE_CONFIG[device.subtype].label}
                  </Badge>
                )}
                {device.tag && (
                  <span className="text-xs text-muted-foreground">{device.tag}</span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowEditDialog(true)}>
              <RiEditLine className="size-3.5" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Meters"
          value={`${onlineMeters}/${meters.length}`}
          color={onlineMeters === meters.length ? "text-emerald-600" : "text-amber-600"}
          subtitle="online"
        />
        <MetricCard
          label="Total Power"
          value={formatPower(meters.reduce((sum, m) => {
            const pw = m.latestReadings.find((r) => r.metric === "power_w")
            return sum + (pw?.value ?? 0)
          }, 0))}
          color="text-cyan-600"
          subtitle="live"
        />
        <MetricCard
          label="Last Data"
          value={formatLastSeen(meters.reduce((latest, m) => {
            if (!m.lastSeenAt) return latest
            return !latest || new Date(m.lastSeenAt) > new Date(latest) ? m.lastSeenAt : latest
          }, null as string | null))}
          color="text-emerald-600"
          subtitle="most recent"
        />
      </div>

      {/* Aggregated Readings */}
      {meters.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <RiPulseLine className="size-4 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold">Live Readings</h3>
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
          </div>
          <div className="grid gap-2 grid-cols-3 lg:grid-cols-6">
            {aggregateReadings(meters).map((reading) => (
              <div key={reading.metric} className="rounded-xl border border-border/50 bg-card p-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {formatMetricLabel(reading.metric)}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">
                  {formatReadingValue(reading.value, reading.metric)}
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">{reading.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meters */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiSensorLine className="size-4 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold">Meters</h3>
            <span className="text-xs text-muted-foreground">{meters.length}</span>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5">
            <RiAddLine className="size-3.5" />
            Add Meter
          </Button>
        </div>

        {meters.length === 0 ? (
          <Card className="border-2 border-dashed border-border/60">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <RiSensorLine className="size-8 text-muted-foreground/20" />
              <p className="mt-2 text-sm text-muted-foreground">No meters configured</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Add a meter to start collecting energy data
              </p>
              <Button size="sm" className="mt-4 gap-1.5">
                <RiAddLine className="size-3.5" />
                Add Meter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {meters.map((meter) => (
              <MeterCard
                key={meter.id}
                meter={meter}
                expanded={expandedMeter === meter.id}
                onToggle={() => setExpandedMeter(expandedMeter === meter.id ? null : meter.id)}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <button
          onClick={() => setShowEvents(!showEvents)}
          className="mb-3 flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <RiBarChartBoxLine className="size-4 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <span className="text-xs text-muted-foreground">{MOCK_EVENTS.length}</span>
          </div>
          {showEvents ? (
            <RiArrowUpSLine className="size-4 text-muted-foreground" />
          ) : (
            <RiArrowDownSLine className="size-4 text-muted-foreground" />
          )}
        </button>

        {showEvents && (
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {MOCK_EVENTS.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5">
                      <EventIcon type={event.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{event.message}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground/60">
                          {event.source === "meter" ? event.sourceName : "Device"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Device Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md gap-0 p-0">
          <div className="space-y-5 p-6">
            <div>
              <h2 className="text-lg font-semibold">Edit Device</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Update device configuration</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name" className="text-xs">Name</Label>
                <Input id="edit-name" defaultValue={device.name} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="edit-tag" className="text-xs">Tag</Label>
                <Input id="edit-tag" defaultValue={device.tag || ""} placeholder="e.g. Main grid import/export" className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-brand" className="text-xs">Brand</Label>
                  <Input id="edit-brand" defaultValue={device.brand} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="edit-model" className="text-xs">Model</Label>
                  <Input id="edit-model" defaultValue={device.model} className="mt-1.5" />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between p-4 px-6">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => {
                setShowEditDialog(false)
              }}
            >
              <RiDeleteBinLine className="mr-1.5 size-3.5" />
              Delete device
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => {
                toast.success("Device updated")
                setShowEditDialog(false)
              }}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// --- Sub-components ---

function MetricCard({
  label,
  value,
  color,
  subtitle,
}: {
  label: string
  value: string
  color: string
  subtitle: string
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function MeterCard({
  meter,
  expanded,
  onToggle,
  onCopy,
}: {
  meter: Meter
  expanded: boolean
  onToggle: () => void
  onCopy: (text: string, label: string) => void
}) {
  const proto = PROTOCOL_CONFIG[meter.protocol]
  const ProtoIcon = proto.icon
  const power = meter.latestReadings.find((r) => r.metric === "power_w")

  return (
    <Card className={cn("border-border/50 transition-all", expanded && "ring-1 ring-border")}>
      {/* Header — always visible */}
      <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", proto.bg)}>
          <ProtoIcon className={cn("size-5", proto.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{meter.serialNumber}</p>
            <StatusDot status={meter.isOnline ? "online" : "offline"} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {meter.vendor} · {proto.label}
            {meter.lastSeenAt && ` · ${formatLastSeen(meter.lastSeenAt)}`}
          </p>
        </div>
        {power && (
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-sm font-bold tabular-nums text-cyan-600">{formatPower(power.value)}</p>
            <p className="text-[10px] text-muted-foreground">live</p>
          </div>
        )}
        <RiArrowRightSLine
          className={cn(
            "size-4 shrink-0 text-muted-foreground/30 transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>

      {/* Expanded — readings + config */}
      {expanded && (
        <div className="border-t border-border/50">
          {/* Readings */}
          <div className="px-4 py-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Latest Readings
            </p>
            <div className="grid gap-2 grid-cols-3 lg:grid-cols-6">
              {meter.latestReadings.map((reading) => (
                <div key={reading.metric} className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    {formatMetricLabel(reading.metric)}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums">
                    {formatReadingValue(reading.value, reading.metric)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">{reading.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Config */}
          <div className="px-4 py-4">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Configuration
            </p>
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-3">
                <InfoRow label="Serial" value={meter.serialNumber} mono />
                <InfoRow label="Protocol" value={proto.label} />
                <InfoRow label="Vendor" value={meter.vendor} />
                {Object.entries(meter.config).map(([key, value]) => (
                  <InfoRow key={key} label={key.replace(/_/g, " ")} value={value} />
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="xs" className="gap-1 text-xs">
                <RiRefreshLine className="size-3" />
                Ping
              </Button>
              <Button variant="outline" size="xs" className="gap-1 text-xs">
                <RiSettings3Line className="size-3" />
                Configure
              </Button>
            </div>
            <Button variant="ghost" size="xs" className="gap-1 text-xs text-destructive hover:bg-destructive/10">
              <RiDeleteBinLine className="size-3" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function StatusDot({ status }: { status: "online" | "offline" | "degraded" }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex size-1.5">
        {status === "online" && (
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", config.dot)} />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", config.dot)} />
      </span>
      <span className={cn("text-[11px] font-medium", config.color)}>{config.label}</span>
    </span>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className={cn("mt-0.5 text-sm", mono && "font-mono text-xs")}>{value}</p>
    </div>
  )
}

function EventIcon({ type }: { type: EventLog["type"] }) {
  const config: Record<EventLog["type"], { icon: typeof RiCheckboxCircleLine; color: string; bg: string }> = {
    connected: { icon: RiCheckboxCircleLine, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    disconnected: { icon: RiSignalWifiOffLine, color: "text-red-600", bg: "bg-red-500/10" },
    error: { icon: RiAlertLine, color: "text-amber-600", bg: "bg-amber-500/10" },
    config_changed: { icon: RiSettings3Line, color: "text-blue-600", bg: "bg-blue-500/10" },
    data_received: { icon: RiBarChartBoxLine, color: "text-muted-foreground", bg: "bg-muted/50" },
  }
  const c = config[type]
  const Icon = c.icon
  return (
    <div className={cn("flex size-7 items-center justify-center rounded-lg", c.bg)}>
      <Icon className={cn("size-3.5", c.color)} />
    </div>
  )
}

// --- Helpers ---

function aggregateReadings(meters: Meter[]): MeterReading[] {
  const byMetric = new Map<string, { value: number; unit: string; count: number; timestamp: string }>()
  const sumMetrics = new Set(["power_w", "current_a", "energy_kwh"])

  for (const meter of meters) {
    for (const reading of meter.latestReadings) {
      const existing = byMetric.get(reading.metric)
      if (!existing) {
        byMetric.set(reading.metric, { value: reading.value, unit: reading.unit, count: 1, timestamp: reading.timestamp })
      } else if (sumMetrics.has(reading.metric)) {
        existing.value += reading.value
        existing.count++
      } else {
        existing.value = (existing.value * existing.count + reading.value) / (existing.count + 1)
        existing.count++
      }
    }
  }

  return Array.from(byMetric.entries()).map(([metric, data]) => ({
    metric,
    value: data.value,
    unit: data.unit,
    timestamp: data.timestamp,
  }))
}

function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`
  return `${watts.toFixed(0)} W`
}

function formatReadingValue(value: number, metric: string): string {
  if (metric === "pf") return value.toFixed(2)
  if (metric === "energy_kwh") return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (metric === "frequency") return value.toFixed(2)
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return value.toFixed(1)
}

function formatMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    power_w: "Power",
    energy_kwh: "Energy",
    voltage_v: "Voltage",
    current_a: "Current",
    frequency: "Frequency",
    pf: "Power Factor",
  }
  return labels[metric] || metric.replace(/_/g, " ")
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

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
