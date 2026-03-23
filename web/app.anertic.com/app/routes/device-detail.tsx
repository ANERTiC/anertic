import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import useSWR from "swr"
import {
  RiArrowLeftLine,
  RiSettings3Line,
  RiEditLine,
  RiDeleteBinLine,
  RiBarChartBoxLine,
  RiAddLine,
  RiSensorLine,
  RiDashboard3Line,
  RiPulseLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiLoader4Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Dialog, DialogContent } from "~/components/ui/dialog"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"
import { fetcher } from "~/lib/api"
import { useSiteId } from "~/layouts/site"
import {
  MeterCard,
  CHANNEL_CONFIG,
  PROTOCOL_CONFIG,
  PHASE_OPTIONS,
  ANERTIC_MQTT_BROKER,
  ANERTIC_INGEST_URL,
  formatPower,
  type Meter,
  type MeterProtocol,
  type MeterChannel,
  CopyableField,
} from "~/components/meter-card"
import {
  DEVICE_TYPE_CONFIG,
  DEVICE_CHANNEL_HINTS,
  formatLastSeen,
  type Device,
  type DeviceType,
} from "~/lib/device"


// --- API Types ---

interface MeterListResult {
  items: Meter[]
}

interface DeviceReading {
  time: string
  powerW: number
  energyKwh: number
  voltageV: number
  currentA: number
}

interface LatestReadingResult {
  reading: DeviceReading | null
}

// --- Component ---

export default function DeviceDetail() {
  const navigate = useNavigate()
  const { deviceId } = useParams()
  const siteId = useSiteId()
  const [expandedMeter, setExpandedMeter] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showAddMeter, setShowAddMeter] = useState(false)
  const [showEvents, setShowEvents] = useState(false)

  const { data: device, isLoading: deviceLoading, mutate: mutateDevice } = useSWR<Device>(
    deviceId ? ["device.get", { id: deviceId }] : null,
    fetcher,
  )

  const { data: metersData, isLoading: metersLoading, mutate: mutateMeters } = useSWR<MeterListResult>(
    deviceId && siteId ? ["meter.list", { siteId, deviceId }] : null,
    fetcher,
  )

  const { data: latestReading } = useSWR<LatestReadingResult>(
    deviceId ? ["reading.latest", { deviceId }] : null,
    fetcher,
  )

  if (deviceLoading || metersLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RiLoader4Line className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Device not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/devices")}>
          Back to devices
        </Button>
      </div>
    )
  }

  async function handleDeleteDevice() {
    if (!confirm("Are you sure you want to delete this device? It will be deactivated and hidden from the device list.")) {
      return
    }
    try {
      await fetcher(["device.delete", { siteId, id: deviceId }])
      toast.success("Device deleted")
      navigate("/devices")
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete device")
    }
  }

  const meters = metersData?.items ?? []
  const typeConfig = DEVICE_TYPE_CONFIG[device.type]
  const TypeIcon = typeConfig.icon

  const onlineMeters = meters.filter((m) => m.isOnline).length
  const reading = latestReading?.reading ?? null

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
          value={formatPower(reading?.powerW ?? 0)}
          color="text-cyan-600"
          subtitle="live"
        />
        <MetricCard
          label="Last Data"
          value={formatLastSeen(reading?.time ?? null)}
          color="text-emerald-600"
          subtitle="most recent"
        />
      </div>

      {/* Live Readings */}
      {reading && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <RiPulseLine className="size-4 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold">Live Readings</h3>
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
          </div>
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/50 bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Power</p>
              <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">
                {formatPower(reading.powerW)}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Energy</p>
              <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">
                {reading.energyKwh.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">kWh</span>
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Voltage</p>
              <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">
                {reading.voltageV.toFixed(1)}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">V</span>
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-card p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Current</p>
              <p className="mt-1 text-lg font-bold tabular-nums tracking-tight">
                {reading.currentA.toFixed(1)}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">A</span>
              </p>
            </div>
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
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddMeter(true)}>
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
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowAddMeter(true)}>
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
                siteId={siteId}
                expanded={expandedMeter === meter.id}
                onToggle={() => setExpandedMeter(expandedMeter === meter.id ? null : meter.id)}
                onMutate={() => mutateMeters()}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity — placeholder */}
      <div>
        <button
          onClick={() => setShowEvents(!showEvents)}
          className="mb-3 flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <RiBarChartBoxLine className="size-4 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold">Recent Activity</h3>
          </div>
          {showEvents ? (
            <RiArrowUpSLine className="size-4 text-muted-foreground" />
          ) : (
            <RiArrowDownSLine className="size-4 text-muted-foreground" />
          )}
        </button>

        {showEvents && (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Device Dialog */}
      <EditDeviceDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        device={device}
        siteId={siteId}
        onUpdated={() => mutateDevice()}
        onDelete={handleDeleteDevice}
      />

      {/* Add Meter Dialog */}
      <AddMeterDialog
        open={showAddMeter}
        onOpenChange={setShowAddMeter}
        deviceType={device.type}
        deviceId={device.id}
        siteId={siteId}
        onCreated={() => mutateMeters()}
      />
    </div>
  )
}

// --- Sub-components ---

function EditDeviceDialog({
  open,
  onOpenChange,
  device,
  siteId,
  onUpdated,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: Device
  siteId: string
  onUpdated: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(device.name)
  const [tag, setTag] = useState(device.tag || "")
  const [brand, setBrand] = useState(device.brand)
  const [model, setModel] = useState(device.model)
  const [isActive, setIsActive] = useState(device.isActive)
  const [submitting, setSubmitting] = useState(false)

  // Sync form when device changes or dialog opens
  const resetForm = () => {
    setName(device.name)
    setTag(device.tag || "")
    setBrand(device.brand)
    setModel(device.model)
    setIsActive(device.isActive)
  }

  async function handleSave() {
    setSubmitting(true)
    try {
      await fetcher(["device.update", {
        id: device.id,
        siteId,
        name: name.trim() || undefined,
        tag: tag.trim() || undefined,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        isActive,
      }])
      toast.success("Device updated")
      onUpdated()
      onOpenChange(false)
    } catch (err: any) {
      if (err?.message?.includes("forbidden")) {
        toast.error("You don't have permission to update this device")
      } else if (err?.message?.includes("not found")) {
        toast.error("Device not found")
      } else {
        toast.error(err?.message || "Failed to update device")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v) resetForm() }}>
      <DialogContent className="max-w-md gap-0 p-0">
        <div className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold">Edit Device</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Update device configuration</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name" className="text-xs">Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="edit-tag" className="text-xs">Tag</Label>
              <Input id="edit-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Main grid import/export" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-brand" className="text-xs">Brand</Label>
                <Input id="edit-brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="edit-model" className="text-xs">Model</Label>
                <Input id="edit-model" value={model} onChange={(e) => setModel(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
              <div>
                <Label className="text-xs">Active</Label>
                <p className="text-[11px] text-muted-foreground/60">Disabled devices stop collecting data</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
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
              onOpenChange(false)
              onDelete()
            }}
          >
            <RiDeleteBinLine className="mr-1.5 size-3.5" />
            Delete device
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={submitting}>
              {submitting ? <RiLoader4Line className="mr-1.5 size-3.5 animate-spin" /> : null}
              {submitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

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

function AddMeterDialog({
  open,
  onOpenChange,
  deviceType,
  deviceId,
  siteId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceType: DeviceType
  deviceId: string
  siteId: string
  onCreated: () => void
}) {
  const [protocol, setProtocol] = useState<MeterProtocol>("mqtt")
  const [channel, setChannel] = useState<MeterChannel>(DEVICE_CHANNEL_HINTS[deviceType][0] ?? "load")
  const [phase, setPhase] = useState(0)
  const [serialNumber, setSerialNumber] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!serialNumber.trim()) {
      toast.error("Serial number is required")
      return
    }
    setSubmitting(true)
    try {
      await fetcher(["meter.create", {
        siteId,
        deviceId,
        serialNumber: serialNumber.trim(),
        protocol,
        phase,
        channel,
      }])
      toast.success("Meter added", {
        description: `${serialNumber} · ${CHANNEL_CONFIG[channel].label} · ${PHASE_OPTIONS.find((p) => p.value === phase)?.label}`,
      })
      onCreated()
      onOpenChange(false)
      resetForm()
    } catch (err: any) {
      toast.error(err?.message || "Failed to create meter")
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSerialNumber("")
    setProtocol("mqtt")
    setChannel(DEVICE_CHANNEL_HINTS[deviceType][0] ?? "load")
    setPhase(0)
  }

  const suggestedChannels = DEVICE_CHANNEL_HINTS[deviceType]
  const allChannels: MeterChannel[] = ["pv", "grid", "battery", "ev", "load"]

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="sm:max-w-5xl gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <RiDashboard3Line className="size-5 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Add Meter</h2>
              <p className="text-xs text-muted-foreground">
                Configure a data source for this {DEVICE_TYPE_CONFIG[deviceType].label.toLowerCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="max-h-[65vh] overflow-y-auto">
          <div className="space-y-5 p-6">
            {/* Serial Number */}
            <div>
              <Label className="text-xs text-muted-foreground">Serial Number</Label>
              <Input
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g. SDM-2030-4821"
                className="mt-1.5 font-mono text-sm"
              />
            </div>

            {/* Channel */}
            <div>
              <Label className="text-xs text-muted-foreground">Channel</Label>
              <p className="mb-2 text-[11px] text-muted-foreground/60">
                What this meter measures — determines dashboard category
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allChannels.map((ch) => {
                  const config = CHANNEL_CONFIG[ch]
                  const Icon = config.icon
                  const isSuggested = suggestedChannels.includes(ch)
                  const isActive = channel === ch
                  return (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        isActive
                          ? "border-foreground/20 bg-foreground/5 text-foreground shadow-sm"
                          : isSuggested
                            ? "border-border/60 text-foreground/80 hover:border-foreground/20 hover:bg-muted/50"
                            : "border-transparent text-muted-foreground/50 hover:border-border/40 hover:text-muted-foreground",
                      )}
                    >
                      <Icon className={cn("size-3.5", isActive ? config.color : "")} />
                      {config.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Phase */}
            <div>
              <Label className="text-xs text-muted-foreground">Phase</Label>
              <p className="mb-2 text-[11px] text-muted-foreground/60">
                Electrical line — use Auto for single-phase or DC measurements
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {PHASE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPhase(opt.value)}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-3 py-2.5 transition-all",
                      phase === opt.value
                        ? "border-foreground/20 bg-foreground/5 shadow-sm"
                        : "border-border/50 hover:border-foreground/15 hover:bg-muted/30",
                    )}
                  >
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      phase === opt.value ? "text-foreground" : "text-muted-foreground",
                    )}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Protocol */}
            <div>
              <Label className="text-xs text-muted-foreground">Protocol</Label>
              <select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as MeterProtocol)}
                className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {(Object.keys(PROTOCOL_CONFIG) as MeterProtocol[]).map((proto) => (
                  <option key={proto} value={proto}>
                    {PROTOCOL_CONFIG[proto].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Connection Info */}
            {serialNumber.trim() && (
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <RiSettings3Line className="size-3.5 text-muted-foreground/50" />
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Connection Info
                  </p>
                  <span className="text-[10px] text-muted-foreground/40">— configure your meter to push data here</span>
                </div>

                {protocol === "mqtt" ? (
                  <div className="space-y-2.5">
                    <CopyableField
                      label="Broker"
                      value={ANERTIC_MQTT_BROKER}
                    />
                    <CopyableField
                      label="Topic"
                      value={`meters/${serialNumber.trim()}/telemetry`}
                    />
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">QoS</p>
                        <p className="mt-0.5 text-sm font-mono">1</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <CopyableField
                      label="Webhook URL"
                      value={`${ANERTIC_INGEST_URL}/${serialNumber.trim()}`}
                    />
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Method</p>
                        <p className="mt-0.5 text-sm font-mono">POST</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Content-Type</p>
                        <p className="mt-0.5 text-sm font-mono">application/json</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 px-6">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5">
            {submitting ? <RiLoader4Line className="size-3.5 animate-spin" /> : <RiAddLine className="size-3.5" />}
            {submitting ? "Adding..." : "Add Meter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


