import { useState } from "react"
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
} from "@remixicon/react"
import { toast } from "sonner"

import { useSiteId } from "~/layouts/site"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"

// --- Types ---

type DeviceType = "inverter" | "solar_panel" | "appliance" | "meter"
type Step = "type" | "details"

const STEPS: Step[] = ["type", "details"]
const STEP_LABELS: Record<Step, string> = {
  type: "Type",
  details: "Details",
}

const DEVICE_TYPE_CONFIG: Record<
  DeviceType,
  { label: string; icon: typeof RiCpuLine; color: string; bg: string; description: string; enabled: boolean }
> = {
  meter: {
    label: "Energy Meter",
    icon: RiCpuLine,
    color: "text-cyan-600",
    bg: "bg-cyan-500/10",
    description: "Power and energy measurement device",
    enabled: true,
  },
  inverter: {
    label: "Inverter",
    icon: RiFlashlightLine,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    description: "Solar or hybrid inverter (DC to AC)",
    enabled: false,
  },
  solar_panel: {
    label: "Solar Panel",
    icon: RiSunLine,
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    description: "Photovoltaic panel or array",
    enabled: false,
  },
  appliance: {
    label: "Appliance",
    icon: RiPlugLine,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    description: "Smart appliance, battery, or HVAC",
    enabled: false,
  },
}

// --- Component ---

export default function DeviceNew() {
  const navigate = useNavigate()
  const siteId = useSiteId()

  const [step, setStep] = useState<Step>("type")
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null)
  const [name, setName] = useState("")
  const [tag, setTag] = useState("")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")

  const activeSteps = STEPS
  const activeStepIndex = activeSteps.indexOf(step)

  function handleCreate() {
    toast.success(`Device "${name}" created successfully`)
    navigate("/devices")
  }

  function goNext() {
    const idx = activeSteps.indexOf(step)
    if (idx < activeSteps.length - 1) setStep(activeSteps[idx + 1])
  }

  function goBack() {
    const idx = activeSteps.indexOf(step)
    if (idx > 0) setStep(activeSteps[idx - 1])
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Add Device</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "type" && "Select the hardware type"}
            {step === "details" && "Enter device details"}
          </p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {activeStepIndex + 1} / {activeSteps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {activeSteps.map((s, i) => (
          <button
            key={s}
            onClick={() => { if (i < activeStepIndex) setStep(s) }}
            disabled={i > activeStepIndex}
            className="group flex-1"
          >
            <div
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                i < activeStepIndex
                  ? "bg-foreground"
                  : i === activeStepIndex
                    ? "bg-foreground/50"
                    : "bg-border",
                i < activeStepIndex && "cursor-pointer group-hover:bg-foreground/70",
              )}
            />
            <span className={cn(
              "mt-1.5 block text-[10px] font-medium text-muted-foreground transition-colors",
              i === activeStepIndex && "text-foreground",
            )}>
              {STEP_LABELS[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Step 1: Device Type */}
      {step === "type" && (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.entries(DEVICE_TYPE_CONFIG) as [DeviceType, typeof DEVICE_TYPE_CONFIG[DeviceType]][]).map(
              ([type, config]) => {
                const Icon = config.icon
                const isSelected = selectedType === type
                const isDisabled = !config.enabled
                return (
                  <button
                    key={type}
                    onClick={() => !isDisabled && setSelectedType(type)}
                    disabled={isDisabled}
                    className={cn(
                      "relative rounded-xl border-2 p-5 text-left transition-all",
                      isDisabled
                        ? "cursor-not-allowed opacity-40"
                        : isSelected
                          ? "border-foreground/20 bg-foreground/[0.03] shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-muted/20",
                    )}
                  >
                    {isSelected && (
                      <div className="absolute right-3 top-3">
                        <RiCheckLine className="size-4 text-foreground/40" />
                      </div>
                    )}

                    <div className={cn("mb-3 flex size-10 items-center justify-center rounded-xl", config.bg)}>
                      <Icon className={cn("size-5", config.color)} />
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{config.label}</p>
                      {isDisabled && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {config.description}
                    </p>
                  </button>
                )
              },
            )}
          </div>

          <div className="flex justify-end">
            <Button disabled={!selectedType} onClick={goNext} className="gap-1.5">
              Continue
              <RiArrowRightSLine className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === "details" && (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 space-y-5">
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label htmlFor="device-name" className="text-xs">
                  Device Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="device-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Main DB Meter"
                  className="mt-1.5"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="device-tag" className="text-xs">
                  Tag
                </Label>
                <Input
                  id="device-tag"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="e.g. Building A total power"
                  className="mt-1.5"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Describe what this meter measures
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="device-brand" className="text-xs">Brand</Label>
                  <Input
                    id="device-brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Eastron"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="device-model" className="text-xs">Model</Label>
                  <Input
                    id="device-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. SDM630"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={goBack}>
              <RiArrowLeftSLine className="size-4" />
              Back
            </Button>
            <Button disabled={!name.trim()} onClick={handleCreate} className="gap-1.5">
              <RiCheckLine className="size-4" />
              Create Device
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
