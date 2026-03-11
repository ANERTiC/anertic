import { useState } from "react"
import { useNavigate } from "react-router"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
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

const STEPS = [
  { num: 1, label: "Identify" },
  { num: 2, label: "Configure" },
  { num: 3, label: "Connect" },
] as const

export default function ChargerNew() {
  const navigate = useNavigate()
  const siteId = useSiteId()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [creating, setCreating] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    "waiting" | "connected"
  >("waiting")
  const [copied, setCopied] = useState(false)

  const [chargePointId, setChargePointId] = useState("")
  const [ocppVersion, setOcppVersion] = useState("1.6")
  const [connectorCount, setConnectorCount] = useState("2")
  const [maxPowerKw, setMaxPowerKw] = useState("22")

  const wsUrl = chargePointId
    ? `wss://ocpp.anertic.com/ws/${encodeURIComponent(chargePointId)}`
    : ""

  function goToStep3() {
    setStep(3)
    setConnectionStatus("waiting")
    // Mock: simulate charger connecting after delay
    setTimeout(() => setConnectionStatus("connected"), 5000)
  }

  function copyWsUrl() {
    navigator.clipboard.writeText(wsUrl)
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
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Back + Title */}
      <div>
        <button
          onClick={() => navigate(`/chargers?site=${siteId}`)}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <RiArrowLeftLine className="size-4" />
          Back to Chargers
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Add New Charger
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register an EV charger and connect it via OCPP.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map(({ num, label }, i) => (
          <div key={num} className="flex flex-1 items-center">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                  step > num
                    ? "bg-emerald-500 text-white"
                    : step === num
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step > num ? (
                  <RiCheckboxCircleLine className="size-4" />
                ) : (
                  num
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  step >= num ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-4 h-px flex-1 transition-colors",
                  step > num ? "bg-emerald-500" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Identify */}
      {step === 1 && (
        <Card>
          <CardContent className="space-y-6 py-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <RiChargingPile2Line className="size-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  Identify Your Charger
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the unique charge point identifier that's configured in
                  your EVSE hardware. This ID will be used by the charger to
                  authenticate with the OCPP server.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargePointId" className="text-sm font-medium">
                Charge Point ID
              </Label>
              <Input
                id="chargePointId"
                placeholder="e.g. CP-001, WALLBOX-A1"
                value={chargePointId}
                onChange={(e) => setChargePointId(e.target.value)}
                className="h-12 font-mono text-base"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Must match the identity string configured in your charger's
                firmware. Usually found in the charger's admin panel under OCPP
                settings.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={() => setStep(2)}
                disabled={!chargePointId.trim()}
              >
                Continue
                <RiArrowRightLine className="ml-1.5 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <Card>
          <CardContent className="space-y-6 py-6">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
                <RiSettings3Line className="size-6 text-violet-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Configure Charger</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set the OCPP protocol version and hardware specifications for{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {chargePointId}
                  </span>
                </p>
              </div>
            </div>

            {/* OCPP version selector */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">OCPP Version</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    v: "1.6",
                    title: "OCPP 1.6",
                    desc: "Most widely supported",
                    sub: "JSON / SOAP",
                  },
                  {
                    v: "2.0.1",
                    title: "OCPP 2.0.1",
                    desc: "Latest standard",
                    sub: "JSON only",
                  },
                ].map(({ v, title, desc, sub }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOcppVersion(v)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border-2 px-5 py-4 text-left transition-all",
                      ocppVersion === v
                        ? "border-foreground bg-foreground/[0.03] shadow-sm"
                        : "border-border hover:border-foreground/20",
                    )}
                  >
                    <span className="text-sm font-semibold">{title}</span>
                    <span className="text-xs text-muted-foreground">
                      {desc}
                    </span>
                    <span className="mt-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hardware specs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="connectorCount"
                  className="flex items-center gap-1.5 text-sm font-medium"
                >
                  <RiPlugLine className="size-3.5 text-muted-foreground" />
                  Connectors
                </Label>
                <Input
                  id="connectorCount"
                  type="number"
                  min="1"
                  max="8"
                  value={connectorCount}
                  onChange={(e) => setConnectorCount(e.target.value)}
                  className="h-11"
                />
                <p className="text-[11px] text-muted-foreground">
                  Number of physical charging ports
                </p>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="maxPowerKw"
                  className="flex items-center gap-1.5 text-sm font-medium"
                >
                  <RiFlashlightLine className="size-3.5 text-muted-foreground" />
                  Max Power (kW)
                </Label>
                <Input
                  id="maxPowerKw"
                  type="number"
                  step="0.1"
                  placeholder="22"
                  value={maxPowerKw}
                  onChange={(e) => setMaxPowerKw(e.target.value)}
                  className="h-11"
                />
                <p className="text-[11px] text-muted-foreground">
                  Maximum output power capacity
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <RiArrowLeftLine className="mr-1.5 size-4" />
                Back
              </Button>
              <Button size="lg" onClick={goToStep3}>
                Register & Connect
                <RiArrowRightLine className="ml-1.5 size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Connect */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Connection status card */}
          <Card
            className={cn(
              "overflow-hidden transition-colors",
              connectionStatus === "connected" && "border-emerald-200",
            )}
          >
            <CardContent className="space-y-6 py-6">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                    connectionStatus === "connected"
                      ? "bg-emerald-500/10"
                      : "bg-amber-500/10",
                  )}
                >
                  {connectionStatus === "connected" ? (
                    <RiCheckboxCircleLine className="size-6 text-emerald-500" />
                  ) : (
                    <RiLoader4Line className="size-6 animate-spin text-amber-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    {connectionStatus === "connected"
                      ? "Charger Connected!"
                      : "Waiting for Connection"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {connectionStatus === "connected"
                      ? `${chargePointId} is online and ready to charge via OCPP ${ocppVersion}.`
                      : "Configure your charger's OCPP client to connect to the endpoint below."}
                  </p>
                </div>
              </div>

              {/* WebSocket URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <RiLinksLine className="size-3.5" />
                  WebSocket Endpoint
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 overflow-hidden rounded-lg border bg-muted/40 px-4 py-3">
                    <p className="truncate font-mono text-sm">{wsUrl}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0"
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

              {/* Connection progress indicator */}
              {connectionStatus === "waiting" && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/30 px-4 py-3">
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Listening for boot notification...</p>
                    <p className="text-xs text-muted-foreground">
                      The charger will send a BootNotification when it connects
                    </p>
                  </div>
                </div>
              )}

              {connectionStatus === "connected" && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/30 px-4 py-3">
                  <RiCheckboxCircleLine className="size-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700">
                      BootNotification received
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Charger registered and heartbeat is active
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration reference */}
          {connectionStatus === "waiting" && (
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <RiSettings3Line className="size-4 text-muted-foreground" />
                  Charger Configuration Reference
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    {
                      label: "Charge Point ID",
                      value: chargePointId,
                      mono: true,
                    },
                    {
                      label: "Protocol",
                      value: `OCPP ${ocppVersion} (${ocppVersion === "1.6" ? "ocpp1.6" : "ocpp2.0.1"})`,
                    },
                    {
                      label: "WebSocket URL",
                      value: wsUrl,
                      mono: true,
                    },
                    {
                      label: "Connectors",
                      value: `${connectorCount} port${parseInt(connectorCount) !== 1 ? "s" : ""}`,
                    },
                    {
                      label: "Max Power",
                      value: `${maxPowerKw} kW`,
                    },
                  ].map(({ label, value, mono }) => (
                    <div
                      key={label}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {label}
                      </span>
                      <span
                        className={cn(
                          "truncate text-right text-sm",
                          mono && "font-mono text-xs",
                        )}
                      >
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
            <Button variant="ghost" onClick={() => setStep(2)}>
              <RiArrowLeftLine className="mr-1.5 size-4" />
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
              <Button size="lg" onClick={handleRegister} disabled={creating}>
                {creating ? "Saving..." : "Done - Go to Charger"}
                <RiArrowRightLine className="ml-1.5 size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
