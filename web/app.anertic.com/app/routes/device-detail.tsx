import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import {
  RiArrowLeftLine,
  RiCpuLine,
  RiSunLine,
  RiPlugLine,
  RiFlashlightLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiTimeLine,
  RiSettings3Line,
  RiRefreshLine,
  RiKeyLine,
  RiClipboardLine,
  RiEyeLine,
  RiEyeOffLine,
  RiTerminalLine,
  RiEditLine,
  RiDeleteBinLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiBarChartBoxLine,
  RiHistoryLine,
  RiInformationLine,
  RiLink,
  RiCodeLine,
  RiFileListLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { useSiteId } from "~/layouts/site"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { cn } from "~/lib/utils"

// --- Types ---

type DeviceType = "inverter" | "solar_panel" | "appliance" | "meter"
type Protocol = "mqtt" | "rest"
type ConnectionStatus = "online" | "offline" | "degraded"

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
  dataPointsTotal: number
  uptimePercent: number
  createdAt: string
  metadata: Record<string, string>
}

interface DataLog {
  timestamp: string
  type: string
  value: string
  unit: string
}

interface EventLog {
  id: string
  timestamp: string
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

// --- Mock Data ---

function getMockDevice(id: string): Device {
  return {
    id,
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
    dataPointsTotal: 1_284_320,
    uptimePercent: 99.8,
    createdAt: "2025-08-15T10:00:00Z",
    metadata: {
      serial_number: "SMA-INV-2030-4821",
      max_power_kw: "10.0",
      phases: "3",
      mppt_count: "2",
      communication_protocol: "SMA Speedwire",
    },
  }
}

const MOCK_DATA_LOGS: DataLog[] = [
  { timestamp: new Date(Date.now() - 5000).toISOString(), type: "ac_power", value: "4.23", unit: "kW" },
  { timestamp: new Date(Date.now() - 5000).toISOString(), type: "dc_voltage", value: "385.2", unit: "V" },
  { timestamp: new Date(Date.now() - 5000).toISOString(), type: "dc_current", value: "11.0", unit: "A" },
  { timestamp: new Date(Date.now() - 5000).toISOString(), type: "frequency", value: "50.01", unit: "Hz" },
  { timestamp: new Date(Date.now() - 5000).toISOString(), type: "temperature", value: "42.5", unit: "°C" },
  { timestamp: new Date(Date.now() - 10000).toISOString(), type: "ac_power", value: "4.18", unit: "kW" },
  { timestamp: new Date(Date.now() - 10000).toISOString(), type: "dc_voltage", value: "384.8", unit: "V" },
  { timestamp: new Date(Date.now() - 10000).toISOString(), type: "dc_current", value: "10.9", unit: "A" },
  { timestamp: new Date(Date.now() - 10000).toISOString(), type: "frequency", value: "50.00", unit: "Hz" },
  { timestamp: new Date(Date.now() - 10000).toISOString(), type: "temperature", value: "42.3", unit: "°C" },
  { timestamp: new Date(Date.now() - 15000).toISOString(), type: "ac_power", value: "4.15", unit: "kW" },
  { timestamp: new Date(Date.now() - 15000).toISOString(), type: "dc_voltage", value: "383.9", unit: "V" },
  { timestamp: new Date(Date.now() - 15000).toISOString(), type: "dc_current", value: "10.8", unit: "A" },
  { timestamp: new Date(Date.now() - 15000).toISOString(), type: "frequency", value: "49.99", unit: "Hz" },
  { timestamp: new Date(Date.now() - 15000).toISOString(), type: "temperature", value: "42.1", unit: "°C" },
]

const MOCK_EVENTS: EventLog[] = [
  { id: "e1", timestamp: new Date(Date.now() - 5000).toISOString(), type: "data_received", message: "Telemetry batch received (5 data points)" },
  { id: "e2", timestamp: new Date(Date.now() - 10000).toISOString(), type: "data_received", message: "Telemetry batch received (5 data points)" },
  { id: "e3", timestamp: new Date(Date.now() - 300000).toISOString(), type: "connected", message: "Device reconnected via MQTT" },
  { id: "e4", timestamp: new Date(Date.now() - 360000).toISOString(), type: "disconnected", message: "Connection lost — timeout after 30s" },
  { id: "e5", timestamp: new Date(Date.now() - 3600000).toISOString(), type: "config_changed", message: "Polling interval changed from 10s to 5s" },
  { id: "e6", timestamp: new Date(Date.now() - 7200000).toISOString(), type: "error", message: "Connection timeout — retried successfully" },
  { id: "e7", timestamp: new Date(Date.now() - 86400000).toISOString(), type: "connected", message: "Initial connection established" },
]

// --- Component ---

export default function DeviceDetail() {
  const navigate = useNavigate()
  const { deviceId } = useParams()
  const [showApiKey, setShowApiKey] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  const device = getMockDevice(deviceId || "dev_01")
  const typeConfig = DEVICE_TYPE_CONFIG[device.type]
  const TypeIcon = typeConfig.icon
  const statusConfig = STATUS_CONFIG[device.connectionStatus]
  const protocolConfig = PROTOCOL_CONFIG[device.protocol]

  const mockApiKey = `${device.apiKeyPrefix}test_0000000000000000`
  const endpoint =
    device.protocol === "mqtt"
      ? `mqtt://broker.anertic.com:1883/devices/${device.id}/telemetry`
      : `https://api.anertic.com/v1/devices/${device.id}/ingest`

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
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
                <h1 className="text-2xl font-semibold tracking-tight">{device.name}</h1>
                {!device.isActive && (
                  <Badge variant="secondary">Disabled</Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {device.brand} {device.model}
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex size-2">
                    {device.connectionStatus === "online" && (
                      <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", statusConfig.dot)} />
                    )}
                    <span className={cn("relative inline-flex size-2 rounded-full", statusConfig.dot)} />
                  </span>
                  <span className={cn("text-xs font-medium", statusConfig.color)}>
                    {statusConfig.label}
                  </span>
                </div>
                <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", protocolConfig.color)}>
                  {protocolConfig.label}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {typeConfig.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <RiRefreshLine className="size-3.5" />
              Ping
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RiEditLine className="size-3.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10">
              <RiDeleteBinLine className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Uptime"
          value={`${device.uptimePercent}%`}
          color={device.uptimePercent >= 99 ? "text-emerald-600" : "text-amber-600"}
          subtitle="Last 30 days"
        />
        <MetricCard
          label="Data Points Today"
          value={device.dataPointsToday.toLocaleString()}
          color="text-foreground"
          subtitle={`${device.dataPointsTotal.toLocaleString()} total`}
        />
        <MetricCard
          label="Last Seen"
          value={formatLastSeen(device.lastSeenAt)}
          color={device.connectionStatus === "online" ? "text-emerald-600" : "text-muted-foreground"}
          subtitle={device.lastSeenAt ? formatTime(device.lastSeenAt) : "Never connected"}
        />
        <MetricCard
          label="Created"
          value={formatDateShort(device.createdAt)}
          color="text-foreground"
          subtitle={formatTime(device.createdAt)}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="overview" className="gap-1.5">
            <RiInformationLine className="size-3.5" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5">
            <RiBarChartBoxLine className="size-3.5" />
            <span className="hidden sm:inline">Live Data</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <RiHistoryLine className="size-3.5" />
            <span className="hidden sm:inline">Events</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <RiSettings3Line className="size-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Connection Config */}
            <Card className="border-border/50">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <RiLink className="size-4 text-muted-foreground/50" />
                  <h3 className="text-sm font-semibold">Connection</h3>
                </div>

                <CopyField
                  label="Endpoint"
                  value={endpoint}
                  icon={RiTerminalLine}
                  onCopy={() => handleCopy(endpoint, "Endpoint")}
                />

                <div>
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <RiKeyLine className="size-3.5 shrink-0 text-muted-foreground/50" />
                    <code className="flex-1 truncate text-xs">
                      {showApiKey ? mockApiKey : `${device.apiKeyPrefix}test_••••••••••••••••`}
                    </code>
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="shrink-0 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
                    >
                      {showApiKey ? <RiEyeOffLine className="size-3.5" /> : <RiEyeLine className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => handleCopy(mockApiKey, "API key")}
                      className="shrink-0 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
                    >
                      <RiClipboardLine className="size-3.5" />
                    </button>
                  </div>
                </div>

                <CopyField
                  label="Device ID"
                  value={device.id}
                  icon={RiCpuLine}
                  mono
                  onCopy={() => handleCopy(device.id, "Device ID")}
                />
              </CardContent>
            </Card>

            {/* Device Info */}
            <Card className="border-border/50">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <RiFileListLine className="size-4 text-muted-foreground/50" />
                  <h3 className="text-sm font-semibold">Device Info</h3>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <InfoRow label="Brand" value={device.brand} />
                  <InfoRow label="Model" value={device.model} />
                  {device.ipAddress && <InfoRow label="IP Address" value={device.ipAddress} />}
                  {device.firmwareVersion && <InfoRow label="Firmware" value={`v${device.firmwareVersion}`} />}
                  <InfoRow label="Protocol" value={protocolConfig.label} />
                  <InfoRow label="Type" value={typeConfig.label} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metadata */}
          {Object.keys(device.metadata).length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <RiCodeLine className="size-4 text-muted-foreground/50" />
                  <h3 className="text-sm font-semibold">Metadata</h3>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 lg:grid-cols-3">
                    {Object.entries(device.metadata).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Integration Guide */}
          <Card className="border-border/50 bg-gradient-to-br from-muted/20 via-background to-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <RiTerminalLine className="size-4 text-muted-foreground/50" />
                <h3 className="text-sm font-semibold">Quick Integration</h3>
              </div>
              <div className="rounded-lg border border-border/50 bg-foreground/[0.02] p-4">
                <pre className="overflow-x-auto text-xs leading-relaxed text-muted-foreground">
                  <code>{getIntegrationSnippet(device, endpoint, mockApiKey)}</code>
                </pre>
              </div>
              <button
                onClick={() => handleCopy(getIntegrationSnippet(device, endpoint, mockApiKey), "Code snippet")}
                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RiClipboardLine className="size-3" />
                Copy snippet
              </button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Data Tab */}
        <TabsContent value="data" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Latest telemetry data from this device
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              Streaming
            </div>
          </div>

          {/* Latest Values */}
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {MOCK_DATA_LOGS.slice(0, 5).map((log) => (
              <Card key={log.type} className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    {log.type.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">
                    {log.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{log.unit}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Data Stream Table */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="border-b border-border/50 px-5 py-3">
                <h3 className="text-sm font-semibold">Data Stream</h3>
              </div>
              <div className="divide-y divide-border/30">
                {MOCK_DATA_LOGS.map((log, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-2.5">
                    <span className="w-20 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatTime(log.timestamp)}
                    </span>
                    <span className="w-28 shrink-0 text-xs font-medium">
                      {log.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {log.value}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{log.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Connection events and status changes
          </p>

          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {MOCK_EVENTS.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="mt-0.5">
                      <EventIcon type={event.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{event.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRelativeTime(event.timestamp)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card className="border-border/50">
            <CardContent className="space-y-5 p-5">
              <h3 className="text-sm font-semibold">Device Configuration</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="device-name" className="text-xs">Device Name</Label>
                  <Input id="device-name" defaultValue={device.name} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="device-brand" className="text-xs">Brand</Label>
                  <Input id="device-brand" defaultValue={device.brand} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="device-model" className="text-xs">Model</Label>
                  <Input id="device-model" defaultValue={device.model} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="device-ip" className="text-xs">IP Address</Label>
                  <Input id="device-ip" defaultValue={device.ipAddress || ""} placeholder="e.g. 192.168.1.40" className="mt-1.5" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm">Save changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="space-y-4 p-5">
              <h3 className="text-sm font-semibold">Polling Configuration</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="poll-interval" className="text-xs">Poll Interval (seconds)</Label>
                  <Input id="poll-interval" type="number" defaultValue="5" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="timeout" className="text-xs">Timeout (seconds)</Label>
                  <Input id="timeout" type="number" defaultValue="30" className="mt-1.5" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button size="sm">Save changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="space-y-4 p-5">
              <h3 className="text-sm font-semibold">API Key Management</h3>
              <p className="text-xs text-muted-foreground">
                Regenerating the API key will invalidate the current key. The device will need to be reconfigured.
              </p>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <RiKeyLine className="size-3.5" />
                Regenerate API Key
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/20">
            <CardContent className="space-y-4 p-5">
              <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">
                    {device.isActive ? "Disable this device" : "Enable this device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {device.isActive
                      ? "The device will stop sending data and disconnect."
                      : "Re-enable data collection from this device."}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  {device.isActive ? "Disable" : "Enable"}
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Delete this device</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently remove this device and all its data. This cannot be undone.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                  <RiDeleteBinLine className="mr-1.5 size-3.5" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
    <Card className="border-border/50">
      <CardContent className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          {label}
        </p>
        <p className={cn("mt-1 text-lg font-bold tabular-nums", color)}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function CopyField({
  label,
  value,
  icon: Icon,
  mono,
  onCopy,
}: {
  label: string
  value: string
  icon: typeof RiTerminalLine
  mono?: boolean
  onCopy: () => void
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
        <Icon className="size-3.5 shrink-0 text-muted-foreground/50" />
        <code className={cn("flex-1 truncate text-xs", mono && "font-mono")}>{value}</code>
        <button
          onClick={onCopy}
          className="shrink-0 rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
        >
          <RiClipboardLine className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
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

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function formatDateShort(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

function getIntegrationSnippet(device: Device, endpoint: string, apiKey: string): string {
  if (device.protocol === "mqtt") {
    return `# MQTT — publish telemetry
mosquitto_pub \\
  -h broker.anertic.com \\
  -p 1883 \\
  -t "devices/${device.id}/telemetry" \\
  -u "${device.id}" \\
  -P "${apiKey}" \\
  -m '{"ac_power": 4.23, "dc_voltage": 385.2}'`
  }

  return `# REST API — POST telemetry
curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"ac_power": 4.23, "dc_voltage": 385.2}'`
}
