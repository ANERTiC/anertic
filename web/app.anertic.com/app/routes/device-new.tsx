import { useState, useMemo } from "react"
import { useNavigate } from "react-router"
import {
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiCheckLine,
  RiCpuLine,
  RiSunLine,
  RiPlugLine,
  RiFlashlightLine,
  RiClipboardLine,
  RiTerminalLine,
  RiLink,
} from "@remixicon/react"
import { toast } from "sonner"

import { useSiteId } from "~/layouts/site"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { cn } from "~/lib/utils"

// --- Types ---

type DeviceType = "inverter" | "solar_panel" | "appliance" | "meter"
type Protocol = "mqtt" | "rest"
type MeterPhase = "single" | "three"
type Step = "type" | "details" | "connect"

const STEPS: Step[] = ["type", "details", "connect"]
const STEP_LABELS: Record<Step, string> = {
  type: "Device Type",
  details: "Configuration",
  connect: "Connect",
}

const DEVICE_TYPE_CONFIG: Record<
  DeviceType,
  { label: string; icon: typeof RiCpuLine; color: string; bg: string; description: string }
> = {
  inverter: {
    label: "Inverter",
    icon: RiFlashlightLine,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    description: "Solar or hybrid inverter that converts DC to AC power",
  },
  solar_panel: {
    label: "Solar Panel",
    icon: RiSunLine,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    description: "Photovoltaic panel or array for solar energy generation",
  },
  meter: {
    label: "Energy Meter",
    icon: RiCpuLine,
    color: "text-cyan-600",
    bg: "bg-cyan-500/10",
    description: "Power and energy measurement device (single or three phase)",
  },
  appliance: {
    label: "Appliance",
    icon: RiPlugLine,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    description: "Smart appliance, battery, HVAC, or other controllable device",
  },
}

const PROTOCOL_CONFIG: Record<Protocol, { label: string; description: string; color: string }> = {
  mqtt: { label: "MQTT", description: "Publish telemetry to MQTT broker", color: "text-purple-700 bg-purple-500/10" },
  rest: { label: "REST API", description: "Push data via HTTP POST", color: "text-blue-700 bg-blue-500/10" },
}

// --- Component ---

export default function DeviceNew() {
  const navigate = useNavigate()
  const siteId = useSiteId()

  const [step, setStep] = useState<Step>("type")
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null)
  const [name, setName] = useState("")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [protocol, setProtocol] = useState<Protocol | null>(null)
  const [meterPhase, setMeterPhase] = useState<MeterPhase>("single")

  const stepIndex = STEPS.indexOf(step)
  const canContinueToDetails = selectedType !== null
  const canContinueToConnect = name.trim() && protocol

  // Stable mock IDs (don't regenerate on every render)
  const mockIds = useMemo(
    () => ({
      deviceId: `dev_${Math.random().toString(36).slice(2, 8)}`,
      apiKey: `anertic_${(selectedType || "dev").slice(0, 3)}_test_${Math.random().toString(36).slice(2, 18)}`,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step === "connect"],
  )

  const endpoint =
    protocol === "mqtt"
      ? `mqtt://broker.anertic.com:1883/devices/${mockIds.deviceId}/telemetry`
      : `https://api.anertic.com/v1/devices/${mockIds.deviceId}/ingest`

  function handleCreate() {
    toast.success(`Device "${name}" created successfully`)
    navigate("/devices")
  }

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate("/devices")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <RiArrowLeftLine className="size-4" />
        Back to devices
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Device</h1>
        <p className="text-sm text-muted-foreground">
          Connect a new device to start collecting energy data
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3 flex-1">
            <button
              onClick={() => {
                if (i < stepIndex) setStep(s)
              }}
              disabled={i > stepIndex}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors",
                step === s && "bg-foreground/5",
                i < stepIndex && "cursor-pointer hover:bg-muted/50",
              )}
            >
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  step === s
                    ? "bg-foreground text-background"
                    : i < stepIndex
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < stepIndex ? <RiCheckLine className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  step === s ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px flex-1", i < stepIndex ? "bg-emerald-500/30" : "bg-border/50")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Device Type */}
      {step === "type" && (
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold">Select device type</h2>
              <p className="text-sm text-muted-foreground">
                Choose the type of hardware you're connecting to the platform.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.entries(DEVICE_TYPE_CONFIG) as [DeviceType, typeof DEVICE_TYPE_CONFIG[DeviceType]][]).map(
                ([type, config]) => {
                  const Icon = config.icon
                  const isSelected = selectedType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        "flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all",
                        isSelected
                          ? "border-foreground/20 bg-foreground/[0.03] shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-muted/20",
                      )}
                    >
                      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", config.bg)}>
                        <Icon className={cn("size-5", config.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{config.label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {config.description}
                        </p>
                      </div>
                    </button>
                  )
                },
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                disabled={!canContinueToDetails}
                onClick={() => setStep("details")}
                className="gap-1.5"
              >
                Continue
                <RiArrowRightSLine className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Details */}
      {step === "details" && (
        <Card className="border-border/50">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold">Device configuration</h2>
              <p className="text-sm text-muted-foreground">
                Enter device details and choose the communication protocol.
              </p>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="device-name" className="text-xs">
                Device Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="device-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={selectedType === "meter" ? "e.g. Grid Meter" : selectedType === "inverter" ? "e.g. Main Inverter" : "e.g. Roof Array East"}
                className="mt-1.5"
                autoFocus
              />
            </div>

            {/* Brand + Model */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="device-brand" className="text-xs">Brand</Label>
                <Input
                  id="device-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder={selectedType === "meter" ? "e.g. Eastron" : selectedType === "inverter" ? "e.g. SMA" : "e.g. JA Solar"}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="device-model" className="text-xs">Model</Label>
                <Input
                  id="device-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={selectedType === "meter" ? "e.g. SDM630" : ""}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Meter Phase Selection */}
            {selectedType === "meter" && (
              <div>
                <Label className="text-xs">
                  Phase Configuration <span className="text-destructive">*</span>
                </Label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMeterPhase("single")}
                    className={cn(
                      "rounded-xl border-2 p-4 text-left transition-all",
                      meterPhase === "single"
                        ? "border-foreground/20 bg-foreground/[0.03] shadow-sm"
                        : "border-border/50 hover:border-border",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        <div className="h-5 w-1.5 rounded-full bg-cyan-500" />
                      </div>
                      <p className="text-sm font-semibold">Single Phase</p>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      1P — Standard residential meter (L, N). Measures voltage, current, power, and energy on a single line.
                    </p>
                  </button>
                  <button
                    onClick={() => setMeterPhase("three")}
                    className={cn(
                      "rounded-xl border-2 p-4 text-left transition-all",
                      meterPhase === "three"
                        ? "border-foreground/20 bg-foreground/[0.03] shadow-sm"
                        : "border-border/50 hover:border-border",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        <div className="h-5 w-1.5 rounded-full bg-cyan-500" />
                        <div className="h-5 w-1.5 rounded-full bg-cyan-400" />
                        <div className="h-5 w-1.5 rounded-full bg-cyan-300" />
                      </div>
                      <p className="text-sm font-semibold">Three Phase</p>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      3P — Commercial/industrial meter (L1, L2, L3, N). Measures all three phase lines independently.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Protocol Selection */}
            <div>
              <Label className="text-xs">
                Protocol <span className="text-destructive">*</span>
              </Label>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {(Object.entries(PROTOCOL_CONFIG) as [Protocol, typeof PROTOCOL_CONFIG[Protocol]][]).map(
                  ([proto, config]) => (
                    <button
                      key={proto}
                      onClick={() => {
                        setProtocol(proto)
                      }}
                      className={cn(
                        "rounded-xl border-2 px-4 py-3 text-left transition-all",
                        protocol === proto
                          ? "border-foreground/20 bg-foreground/[0.03] shadow-sm"
                          : "border-border/50 hover:border-border",
                      )}
                    >
                      <p className="text-sm font-semibold">{config.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{config.description}</p>
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep("type")}>
                <RiArrowLeftSLine className="size-4" />
                Back
              </Button>
              <Button
                size="sm"
                disabled={!canContinueToConnect}
                onClick={() => setStep("connect")}
                className="gap-1.5"
              >
                Continue
                <RiArrowRightSLine className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Connect */}
      {step === "connect" && (
        <div className="space-y-4">
          {/* Success Banner */}
          <div className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
              <RiCheckLine className="size-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Ready to connect</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Use the credentials below to connect <strong>{name}</strong>
                {selectedType === "meter" && (
                  <> ({meterPhase === "three" ? "3-phase" : "1-phase"} meter)</>
                )}
              </p>
            </div>
          </div>

          {/* Credentials */}
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-semibold">Connection Credentials</h3>

              <CopyField
                label="Endpoint"
                value={endpoint}
                icon={RiTerminalLine}
                onCopy={() => handleCopy(endpoint, "Endpoint")}
              />
              <CopyField
                label="API Key"
                value={mockIds.apiKey}
                icon={RiLink}
                onCopy={() => handleCopy(mockIds.apiKey, "API key")}
              />
              <CopyField
                label="Device ID"
                value={mockIds.deviceId}
                icon={RiCpuLine}
                onCopy={() => handleCopy(mockIds.deviceId, "Device ID")}
              />
            </CardContent>
          </Card>

          {/* Integration Snippet */}
          <Card className="border-border/50 bg-gradient-to-br from-muted/20 via-background to-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Quick Test</h3>
                <button
                  onClick={() => handleCopy(getSnippet(protocol!, endpoint, mockIds.apiKey, mockIds.deviceId, selectedType === "meter" ? meterPhase : null), "Code snippet")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RiClipboardLine className="size-3" />
                  Copy
                </button>
              </div>
              <div className="rounded-lg border border-border/50 bg-foreground/[0.02] p-4">
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-muted-foreground">
                  <code>
                    {getSnippet(protocol!, endpoint, mockIds.apiKey, mockIds.deviceId, selectedType === "meter" ? meterPhase : null)}
                  </code>
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep("details")}>
              <RiArrowLeftSLine className="size-4" />
              Back
            </Button>
            <Button size="sm" onClick={handleCreate} className="gap-1.5">
              <RiCheckLine className="size-4" />
              Create Device
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function CopyField({
  label,
  value,
  icon: Icon,
  onCopy,
}: {
  label: string
  value: string
  icon: typeof RiTerminalLine
  onCopy: () => void
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
        <Icon className="size-3.5 shrink-0 text-muted-foreground/50" />
        <code className="flex-1 truncate text-xs">{value}</code>
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

// --- Helpers ---

function getSnippet(
  protocol: Protocol,
  endpoint: string,
  apiKey: string,
  deviceId: string,
  meterPhase: MeterPhase | null,
): string {
  const payload = meterPhase === "three"
    ? '{"voltage_l1": 230.1, "voltage_l2": 229.8, "voltage_l3": 230.4, "current_l1": 12.5, "current_l2": 11.8, "current_l3": 13.1, "power_total": 8.62}'
    : meterPhase === "single"
      ? '{"voltage": 230.2, "current": 12.5, "power": 2.88, "energy_total": 1420.5}'
      : '{"power": 4.2, "voltage": 385.2, "energy_today": 18.4}'

  if (protocol === "mqtt") {
    return `# MQTT — publish telemetry
mosquitto_pub \\
  -h broker.anertic.com -p 1883 \\
  -t "devices/${deviceId}/telemetry" \\
  -u "${deviceId}" \\
  -P "${apiKey}" \\
  -m '${payload}'`
  }

  return `# REST API — POST telemetry
curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`
}
