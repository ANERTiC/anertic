import { useState, useEffect } from "react"
import {
  RiPlugLine,
  RiCheckLine,
  RiCloseLine,
  RiRefreshLine,
  RiExternalLinkLine,
  RiTimeLine,
  RiShieldLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiArrowRightLine,
  RiSunLine,
  RiFlashlightLine,
  RiBattery2ChargeLine,
  RiEditLine,
  RiDeleteBinLine,
  RiAddLine,
  RiAlertLine,
  RiLinksLine,
  RiKeyLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiLoopLeftLine,
  RiCpuLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { useSiteId } from "~/layouts/site"
import { Card, CardContent } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Badge } from "~/components/ui/badge"
import { Separator } from "~/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { cn } from "~/lib/utils"

// --- Types ---

type IntegrationStatus = "connected" | "disconnected" | "error" | "syncing"

interface Integration {
  id: string
  provider: string
  name: string
  description: string
  logo: string
  status: IntegrationStatus
  lastSyncAt: string | null
  syncInterval: string
  deviceCount: number
  metrics: IntegrationMetric[]
  config: Record<string, string>
  capabilities: string[]
}

interface IntegrationMetric {
  label: string
  value: string
  icon: typeof RiSunLine
  color: string
}

interface AvailableIntegration {
  id: string
  provider: string
  name: string
  description: string
  logo: string
  capabilities: string[]
  fields: ConfigField[]
}

interface ConfigField {
  key: string
  label: string
  type: "text" | "password" | "url"
  placeholder: string
  required: boolean
  helpText?: string
}

// --- Mock Data ---

function generateConnectedIntegrations(): Integration[] {
  return [
    {
      id: "int-1",
      provider: "fusionsolar",
      name: "FusionSolar",
      description: "Huawei FusionSolar smart PV monitoring",
      logo: "FS",
      status: "connected",
      lastSyncAt: new Date(Date.now() - 120000).toISOString(),
      syncInterval: "5 min",
      deviceCount: 3,
      metrics: [
        { label: "Solar today", value: "24.6 kWh", icon: RiSunLine, color: "text-amber-500" },
        { label: "Battery SoC", value: "72%", icon: RiBattery2ChargeLine, color: "text-emerald-500" },
        { label: "Grid export", value: "8.2 kWh", icon: RiFlashlightLine, color: "text-blue-500" },
      ],
      config: {
        username: "admin@example.com",
        stationCode: "NE=12345678",
      },
      capabilities: ["Solar inverter", "Battery storage", "Smart meter"],
    },
  ]
}

function getAvailableIntegrations(): AvailableIntegration[] {
  return [
    {
      id: "fusionsolar",
      provider: "fusionsolar",
      name: "FusionSolar",
      description: "Connect Huawei inverters, batteries, and smart meters via the FusionSolar Northbound API. Syncs real-time production, consumption, and battery state.",
      logo: "FS",
      capabilities: ["Solar inverter", "Battery storage", "Smart meter", "Grid meter"],
      fields: [
        {
          key: "username",
          label: "FusionSolar Username",
          type: "text",
          placeholder: "your-email@example.com",
          required: true,
          helpText: "Your FusionSolar portal login email",
        },
        {
          key: "password",
          label: "System Code",
          type: "password",
          placeholder: "Enter system code",
          required: true,
          helpText: "System code from FusionSolar installer account",
        },
        {
          key: "stationCode",
          label: "Station Code",
          type: "text",
          placeholder: "NE=12345678",
          required: true,
          helpText: "Found in FusionSolar portal under Plant Info",
        },
      ],
    },
    {
      id: "solaredge",
      provider: "solaredge",
      name: "SolarEdge",
      description: "Monitor SolarEdge inverters and power optimizers. Pull production data, component-level monitoring, and energy metrics.",
      logo: "SE",
      capabilities: ["Solar inverter", "Power optimizer", "Smart meter"],
      fields: [
        {
          key: "apiKey",
          label: "API Key",
          type: "password",
          placeholder: "Enter your SolarEdge API key",
          required: true,
          helpText: "Get from SolarEdge monitoring portal > Admin > Site Access",
        },
        {
          key: "siteId",
          label: "Site ID",
          type: "text",
          placeholder: "1234567",
          required: true,
          helpText: "Numeric site ID from SolarEdge dashboard URL",
        },
      ],
    },
    {
      id: "growatt",
      provider: "growatt",
      name: "Growatt",
      description: "Connect Growatt inverters and batteries. Supports ShineServer API for real-time monitoring and historical data.",
      logo: "GW",
      capabilities: ["Solar inverter", "Battery storage", "Smart meter"],
      fields: [
        {
          key: "username",
          label: "Growatt Username",
          type: "text",
          placeholder: "your-username",
          required: true,
        },
        {
          key: "password",
          label: "Password",
          type: "password",
          placeholder: "Enter password",
          required: true,
        },
        {
          key: "plantId",
          label: "Plant ID",
          type: "text",
          placeholder: "Enter plant ID",
          required: true,
        },
      ],
    },
    {
      id: "shelly",
      provider: "shelly",
      name: "Shelly",
      description: "Connect Shelly energy meters and smart plugs for real-time power monitoring and relay control.",
      logo: "SH",
      capabilities: ["Energy meter", "Smart plug", "Relay control"],
      fields: [
        {
          key: "serverUrl",
          label: "Cloud Server URL",
          type: "url",
          placeholder: "https://shelly-xx-eu.shelly.cloud",
          required: true,
        },
        {
          key: "authKey",
          label: "Auth Key",
          type: "password",
          placeholder: "Enter cloud auth key",
          required: true,
          helpText: "Get from Shelly app > User Settings > Authorization cloud key",
        },
      ],
    },
  ]
}

// --- Helpers ---

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function statusConfig(status: IntegrationStatus) {
  switch (status) {
    case "connected":
      return { label: "Connected", color: "bg-emerald-500/15 text-emerald-700", dot: "bg-emerald-500" }
    case "syncing":
      return { label: "Syncing", color: "bg-blue-500/15 text-blue-700", dot: "bg-blue-500" }
    case "error":
      return { label: "Error", color: "bg-red-500/15 text-red-700", dot: "bg-red-500" }
    case "disconnected":
      return { label: "Disconnected", color: "bg-gray-500/15 text-gray-700", dot: "bg-gray-400" }
  }
}

function providerColor(provider: string) {
  switch (provider) {
    case "fusionsolar":
      return { bg: "bg-red-500", text: "text-white" }
    case "solaredge":
      return { bg: "bg-emerald-600", text: "text-white" }
    case "growatt":
      return { bg: "bg-orange-500", text: "text-white" }
    case "shelly":
      return { bg: "bg-blue-500", text: "text-white" }
    default:
      return { bg: "bg-gray-500", text: "text-white" }
  }
}

// --- Main Component ---

export default function Integrations() {
  const siteId = useSiteId()
  const [mounted, setMounted] = useState(false)
  const [connected, setConnected] = useState<Integration[]>(() => generateConnectedIntegrations())
  const [connectDialog, setConnectDialog] = useState<AvailableIntegration | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [connecting, setConnecting] = useState(false)
  const [editIntegration, setEditIntegration] = useState<Integration | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const available = getAvailableIntegrations()
  const connectedProviders = new Set(connected.map((c) => c.provider))
  const unconnected = available.filter((a) => !connectedProviders.has(a.provider))

  function handleOpenConnect(integration: AvailableIntegration) {
    setFormValues({})
    setShowPasswords({})
    setConnectDialog(integration)
  }

  function handleConnect() {
    if (!connectDialog) return
    setConnecting(true)
    // Simulate API call
    setTimeout(() => {
      const newIntegration: Integration = {
        id: `int-${Date.now()}`,
        provider: connectDialog.provider,
        name: connectDialog.name,
        description: connectDialog.description,
        logo: connectDialog.logo,
        status: "connected",
        lastSyncAt: new Date().toISOString(),
        syncInterval: "5 min",
        deviceCount: 0,
        metrics: [],
        config: { ...formValues },
        capabilities: connectDialog.capabilities,
      }
      setConnected((prev) => [...prev, newIntegration])
      setConnecting(false)
      setConnectDialog(null)
      toast.success(`${connectDialog.name} connected successfully`)
    }, 1500)
  }

  function handleDisconnect(id: string) {
    setConnected((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirm(null)
    toast.success("Integration disconnected")
  }

  function handleSync(id: string) {
    setConnected((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "syncing" as IntegrationStatus, lastSyncAt: new Date().toISOString() } : c,
      ),
    )
    setTimeout(() => {
      setConnected((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "connected" as IntegrationStatus } : c)),
      )
      toast.success("Sync completed")
    }, 2000)
  }

  return (
    <div
      className={cn(
        "space-y-6 transition-opacity duration-500",
        mounted ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Integrations</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Connect external platforms to sync energy data automatically
          </p>
        </div>
      </div>

      {/* Connected Integrations */}
      {connected.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Active Integrations</h2>
          <div className="space-y-4">
            {connected.map((integration) => {
              const sc = statusConfig(integration.status)
              const pc = providerColor(integration.provider)

              return (
                <Card key={integration.id} className="overflow-hidden py-0">
                  <CardContent className="p-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 p-4 pb-0 sm:p-5 sm:pb-0">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div
                          className={cn(
                            "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold sm:size-12",
                            pc.bg,
                            pc.text,
                          )}
                        >
                          {integration.logo}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold sm:text-base">{integration.name}</h3>
                            <Badge className={cn("text-[10px]", sc.color)}>
                              <span className={cn("mr-1 inline-block size-1.5 rounded-full", sc.dot)} />
                              {sc.label}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {integration.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/60">
                            <span className="flex items-center gap-1">
                              <RiTimeLine className="size-3" />
                              Synced {timeAgo(integration.lastSyncAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <RiLoopLeftLine className="size-3" />
                              Every {integration.syncInterval}
                            </span>
                            <span className="flex items-center gap-1">
                              <RiCpuLine className="size-3" />
                              {integration.deviceCount} devices
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => handleSync(integration.id)}
                          disabled={integration.status === "syncing"}
                        >
                          <RiRefreshLine
                            className={cn("size-3.5", integration.status === "syncing" && "animate-spin")}
                          />
                          <span className="hidden sm:inline">Sync</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => setDeleteConfirm(integration.id)}
                        >
                          <RiDeleteBinLine className="size-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Live metrics strip */}
                    {integration.metrics.length > 0 && (
                      <div className="mt-4 grid grid-cols-3 divide-x border-t">
                        {integration.metrics.map((metric) => (
                          <div key={metric.label} className="px-4 py-3 sm:px-5">
                            <div className="flex items-center gap-1.5">
                              <metric.icon className={cn("size-3", metric.color)} />
                              <span className="text-[10px] text-muted-foreground/60">{metric.label}</span>
                            </div>
                            <p className={cn("mt-1 text-sm font-semibold tabular-nums", metric.color)}>
                              {metric.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1.5 border-t px-4 py-3 sm:px-5">
                      {integration.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-[10px]">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {connected.length > 0 ? "Add More Integrations" : "Available Integrations"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {unconnected.map((integration) => {
            const pc = providerColor(integration.provider)

            return (
              <Card
                key={integration.id}
                className="group cursor-pointer py-0 transition-all hover:shadow-md hover:-translate-y-0.5"
                onClick={() => handleOpenConnect(integration)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold sm:size-12",
                        pc.bg,
                        pc.text,
                      )}
                    >
                      {integration.logo}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{integration.name}</h3>
                        <RiArrowRightLine className="size-4 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-foreground/60" />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {integration.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {integration.capabilities.map((cap) => (
                          <Badge key={cap} variant="secondary" className="text-[10px]">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Connect Dialog */}
      <Dialog open={!!connectDialog} onOpenChange={(open) => !open && setConnectDialog(null)}>
        {connectDialog && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl text-sm font-bold",
                    providerColor(connectDialog.provider).bg,
                    providerColor(connectDialog.provider).text,
                  )}
                >
                  {connectDialog.logo}
                </div>
                <div>
                  <DialogTitle>Connect {connectDialog.name}</DialogTitle>
                  <DialogDescription className="mt-0.5">
                    Enter your credentials to start syncing data
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {connectDialog.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key} className="text-xs">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-red-500">*</span>}
                  </Label>
                  <div className="relative">
                    <Input
                      id={field.key}
                      type={
                        field.type === "password" && !showPasswords[field.key]
                          ? "password"
                          : "text"
                      }
                      placeholder={field.placeholder}
                      value={formValues[field.key] || ""}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                    {field.type === "password" && (
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setShowPasswords((prev) => ({
                            ...prev,
                            [field.key]: !prev[field.key],
                          }))
                        }
                      >
                        {showPasswords[field.key] ? (
                          <RiEyeOffLine className="size-4" />
                        ) : (
                          <RiEyeLine className="size-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {field.helpText && (
                    <p className="text-[10px] text-muted-foreground/60">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setConnectDialog(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleConnect}
                disabled={
                  connecting ||
                  connectDialog.fields
                    .filter((f) => f.required)
                    .some((f) => !formValues[f.key]?.trim())
                }
              >
                {connecting ? (
                  <>
                    <RiRefreshLine className="mr-1.5 size-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <RiLinksLine className="mr-1.5 size-4" />
                    Connect
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect Integration</DialogTitle>
            <DialogDescription>
              This will stop syncing data from this integration. Historical data will be preserved. You can reconnect later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDisconnect(deleteConfirm)}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

