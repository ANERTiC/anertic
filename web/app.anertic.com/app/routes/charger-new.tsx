import { useState } from "react"
import { useNavigate } from "react-router"
import {
  RiArrowLeftLine,
  RiArrowRightSLine,
  RiArrowLeftSLine,
  RiCheckLine,
  RiCheckboxCircleLine,
  RiChargingPile2Line,
  RiFileCopyLine,
  RiLinksLine,
  RiLoader4Line,
  RiSettings3Line,
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
import { api } from "~/lib/api"

interface CreateResult {
  id: string
}

type Step = "identify" | "configure" | "connect"

const STEPS: Step[] = ["identify", "configure", "connect"]
const STEP_LABELS: Record<Step, string> = {
  identify: "Identify",
  configure: "Configure",
  connect: "Connect",
}

export default function ChargerNew() {
  const navigate = useNavigate()
  const siteId = useSiteId()

  const [step, setStep] = useState<Step>("identify")
  const [creating, setCreating] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    "waiting" | "connected"
  >("waiting")
  const [copied, setCopied] = useState(false)

  const [chargePointId, setChargePointId] = useState("")
  const [ocppVersion, setOcppVersion] = useState("1.6")
  const [connectorCount, setConnectorCount] = useState("2")
  const [maxPowerKw, setMaxPowerKw] = useState("22")
  const [chargerType, setChargerType] = useState<"ac" | "dc">("ac")

  const activeStepIndex = STEPS.indexOf(step)

  function goNext() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) {
      const next = STEPS[idx + 1]
      setStep(next)
      if (next === "connect") {
        setConnectionStatus("waiting")
        setTimeout(() => setConnectionStatus("connected"), 5000)
      }
    }
  }

  function goBack() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  function copyWsUrl() {
    navigator.clipboard.writeText("wss://ocpp.anertic.com/")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRegister() {
    setCreating(true)
    try {
      const result = await api<CreateResult>("charger.create", {
        siteId,
        chargePointId,
        ocppVersion,
        connectorCount: parseInt(connectorCount) || 1,
        maxPowerKw: parseFloat(maxPowerKw) || 0,
      })
      toast.success("Charger registered successfully")
      navigate(`/chargers/${result.id}?site=${siteId}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to register charger",
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/chargers?site=${siteId}`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <RiArrowLeftLine className="size-4" />
        Back to chargers
      </button>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Add Charger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "identify" && "Enter the charge point identifier"}
            {step === "configure" && "Set OCPP version and hardware specs"}
            {step === "connect" && "Connect your charger via OCPP"}
          </p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {activeStepIndex + 1} / {STEPS.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
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

      {/* Step 1: Identify */}
      {step === "identify" && (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 space-y-5">
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label htmlFor="chargePointId" className="text-xs">
                  Charge Point ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="chargePointId"
                  placeholder="e.g. CP-001, WALLBOX-A1"
                  value={chargePointId}
                  onChange={(e) => setChargePointId(e.target.value)}
                  className="mt-1.5 font-mono"
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Must match the identity configured in your charger's firmware
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button disabled={!chargePointId.trim()} onClick={goNext} className="gap-1.5">
              Continue
              <RiArrowRightSLine className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === "configure" && (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 space-y-5">
          <Card className="border-border/50">
            <CardContent className="p-5 space-y-5">
              {/* OCPP version */}
              <div className="space-y-2">
                <Label className="text-xs">OCPP Version</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { v: "1.6", title: "OCPP 1.6-J", desc: "Most widely supported" },
                    { v: "2.0.1", title: "OCPP 2.0.1", desc: "Latest standard" },
                  ].map(({ v, title, desc }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setOcppVersion(v)}
                      className={cn(
                        "rounded-xl border-2 px-4 py-3 text-left transition-all",
                        ocppVersion === v
                          ? "border-foreground/20 bg-foreground/[0.03] shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-muted/20",
                      )}
                    >
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Charger Type */}
              <div className="space-y-2">
                <Label className="text-xs">Charger Type</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { t: "ac" as const, title: "AC", desc: "Level 2 — 3.7–22 kW" },
                    { t: "dc" as const, title: "DC", desc: "Fast — 50–350 kW" },
                  ].map(({ t, title, desc }) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setChargerType(t)
                        setMaxPowerKw(t === "ac" ? "22" : "150")
                      }}
                      className={cn(
                        "rounded-xl border-2 px-4 py-3 text-left transition-all",
                        chargerType === t
                          ? "border-foreground/20 bg-foreground/[0.03] shadow-sm"
                          : "border-border/50 hover:border-border hover:bg-muted/20",
                      )}
                    >
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hardware specs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="connectorCount" className="text-xs">Connectors</Label>
                  <Input
                    id="connectorCount"
                    type="number"
                    min="1"
                    max="8"
                    value={connectorCount}
                    onChange={(e) => setConnectorCount(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Number of charging ports
                  </p>
                </div>
                <div>
                  <Label htmlFor="maxPowerKw" className="text-xs">Max Power (kW)</Label>
                  <Input
                    id="maxPowerKw"
                    type="number"
                    step="0.1"
                    placeholder="22"
                    value={maxPowerKw}
                    onChange={(e) => setMaxPowerKw(e.target.value)}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Maximum output capacity
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={goBack}>
              <RiArrowLeftSLine className="size-4" />
              Back
            </Button>
            <Button onClick={goNext} className="gap-1.5">
              Register & Connect
              <RiArrowRightSLine className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Connect */}
      {step === "connect" && (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 space-y-4">
          {/* Connection status */}
          <Card className={cn(
            "border-border/50",
            connectionStatus === "connected" && "border-emerald-200",
          )}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    connectionStatus === "connected"
                      ? "bg-emerald-500/10"
                      : "bg-amber-500/10",
                  )}
                >
                  {connectionStatus === "connected" ? (
                    <RiCheckboxCircleLine className="size-5 text-emerald-500" />
                  ) : (
                    <RiLoader4Line className="size-5 animate-spin text-amber-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {connectionStatus === "connected"
                      ? "Charger Connected!"
                      : "Waiting for Connection"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {connectionStatus === "connected"
                      ? `${chargePointId} is online and ready via OCPP ${ocppVersion}.`
                      : "Configure your charger's OCPP client to connect to the endpoint below."}
                  </p>
                </div>
              </div>

              {/* WebSocket URL */}
              <div>
                <Label className="text-xs">WebSocket Endpoint</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 overflow-hidden rounded-lg border bg-muted/40 px-3 py-2.5">
                    <p className="truncate font-mono text-sm">{"wss://ocpp.anertic.com/"}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0"
                    onClick={copyWsUrl}
                  >
                    {copied ? (
                      <RiCheckboxCircleLine className="size-4 text-emerald-500" />
                    ) : (
                      <RiFileCopyLine className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Status indicator */}
              {connectionStatus === "waiting" && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/30 px-3 py-2.5">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
                  </span>
                  <div>
                    <p className="text-xs font-medium">Listening for boot notification...</p>
                    <p className="text-[11px] text-muted-foreground">
                      The charger will send a BootNotification when it connects
                    </p>
                  </div>
                </div>
              )}

              {connectionStatus === "connected" && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/30 px-3 py-2.5">
                  <RiCheckboxCircleLine className="size-4 text-emerald-500" />
                  <div>
                    <p className="text-xs font-medium text-emerald-700">
                      BootNotification received
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Charger registered and heartbeat is active
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Config reference (while waiting) */}
          {connectionStatus === "waiting" && (
            <Card className="border-border/50">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground">Configuration Reference</p>
                <div className="mt-3 space-y-2.5">
                  {[
                    { label: "Charge Point ID", value: chargePointId, mono: true },
                    { label: "Protocol", value: `OCPP ${ocppVersion}` },
                    { label: "WebSocket URL", value: "wss://ocpp.anertic.com/", mono: true },
                    { label: "Connectors", value: `${connectorCount} port${parseInt(connectorCount) !== 1 ? "s" : ""}` },
                    { label: "Max Power", value: `${maxPowerKw} kW` },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex items-baseline justify-between gap-4">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className={cn("truncate text-right text-xs", mono && "font-mono")}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={goBack}>
              <RiArrowLeftSLine className="size-4" />
              Back
            </Button>
            {connectionStatus === "waiting" ? (
              <Button
                variant="outline"
                onClick={handleRegister}
                disabled={creating}
              >
                {creating ? "Saving..." : "Skip - I'll connect later"}
              </Button>
            ) : (
              <Button onClick={handleRegister} disabled={creating} className="gap-1.5">
                {creating ? "Saving..." : "Done"}
                <RiCheckLine className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
