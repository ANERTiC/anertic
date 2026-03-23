import { useState } from "react"
import {
  RiSunLine,
  RiSettings3Line,
  RiRefreshLine,
  RiClipboardLine,
  RiDeleteBinLine,
  RiLink,
  RiWifiLine,
  RiArrowRightSLine,
  RiPulseLine,
  RiBattery2ChargeLine,
  RiEBikeLine,
  RiGridLine,
  RiHome4Line,
  RiLoader4Line,
} from "@remixicon/react"
import { toast } from "sonner"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import { cn } from "~/lib/utils"
import { fetcher } from "~/lib/api"
import { formatLastSeen, type MeterChannel } from "~/lib/device"

// --- Types ---

export type { MeterChannel }
export type MeterProtocol = "mqtt" | "http"

export interface MeterReading {
  metric: string
  value: number
  unit: string
  timestamp: string
}

export interface Meter {
  id: string
  deviceId: string
  name: string
  serialNumber: string
  protocol: MeterProtocol
  phase: number
  channel: MeterChannel
  isOnline: boolean
  lastSeenAt: string | null
  config?: Record<string, string>
  createdAt: string
  latestReadings?: MeterReading[]
}

// --- Config ---

export const PROTOCOL_CONFIG: Record<MeterProtocol, { label: string; color: string; bg: string; icon: typeof RiWifiLine }> = {
  mqtt: { label: "MQTT", color: "text-purple-700", bg: "bg-purple-500/10", icon: RiWifiLine },
  http: { label: "HTTP", color: "text-blue-700", bg: "bg-blue-500/10", icon: RiLink },
}

export const CHANNEL_CONFIG: Record<MeterChannel, { label: string; icon: typeof RiSunLine; color: string; bg: string }> = {
  pv: { label: "Solar", icon: RiSunLine, color: "text-amber-600", bg: "bg-amber-500/10" },
  grid: { label: "Grid", icon: RiGridLine, color: "text-cyan-600", bg: "bg-cyan-500/10" },
  battery: { label: "Battery", icon: RiBattery2ChargeLine, color: "text-green-600", bg: "bg-green-500/10" },
  ev: { label: "EV", icon: RiEBikeLine, color: "text-indigo-600", bg: "bg-indigo-500/10" },
  load: { label: "Load", icon: RiHome4Line, color: "text-rose-600", bg: "bg-rose-500/10" },
}

export const PHASE_OPTIONS = [
  { value: 0, label: "N/A", description: "Unspecified" },
  { value: 1, label: "L1", description: "Line 1" },
  { value: 2, label: "L2", description: "Line 2" },
  { value: 3, label: "L3", description: "Line 3" },
] as const

export const ANERTIC_MQTT_BROKER = "mqtt://broker.anertic.com:1883"
export const ANERTIC_INGEST_URL = "https://api.anertic.com/ingest"

// Channel accent color for left border stripe
const ACCENT_MAP: Record<MeterChannel, string> = {
  pv: "border-l-amber-500",
  grid: "border-l-cyan-500",
  battery: "border-l-green-500",
  ev: "border-l-indigo-500",
  load: "border-l-rose-500",
}

// --- Component ---

type MeterCardMode = "readings" | "configure"

export function MeterCard({
  meter,
  siteId,
  expanded,
  onToggle,
  onMutate,
}: {
  meter: Meter
  siteId: string
  expanded: boolean
  onToggle: () => void
  onMutate?: () => void
}) {
  const [mode, setMode] = useState<MeterCardMode>("readings")

  const proto = PROTOCOL_CONFIG[meter.protocol]
  const ProtoIcon = proto.icon
  const channelCfg = CHANNEL_CONFIG[meter.channel]
  const ChannelIcon = channelCfg.icon
  const readings = meter.latestReadings ?? []
  const config = meter.config ?? {}
  const power = readings.find((r) => r.metric === "power_w")
  const voltage = readings.find((r) => r.metric === "voltage_v")

  // Reset mode when collapsing
  function handleToggle() {
    if (expanded) setMode("readings")
    onToggle()
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/50 bg-card transition-all",
        "border-l-[3px]",
        ACCENT_MAP[meter.channel],
        expanded && "ring-1 ring-border/80 shadow-sm",
      )}
    >
      {/* Header — always visible */}
      <button onClick={handleToggle} className="flex w-full items-center gap-3 p-4 text-left">
        {/* Channel icon + status */}
        <div className="relative flex shrink-0 flex-col items-center gap-1">
          <div className={cn("flex size-9 items-center justify-center rounded-lg", channelCfg.bg)}>
            <ChannelIcon className={cn("size-4.5", channelCfg.color)} />
          </div>
          {meter.isOnline ? (
            <span className="flex items-center gap-1">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
            </span>
          ) : (
            <span className="flex size-1.5 rounded-full bg-muted-foreground/30" />
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-[13px] font-semibold tracking-tight">{meter.name || meter.serialNumber}</p>
            {meter.phase > 0 && (
              <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-foreground/70">
                L{meter.phase}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            {meter.name && (
              <>
                <span className="font-mono">{meter.serialNumber}</span>
                <span className="text-muted-foreground/20">&middot;</span>
              </>
            )}
            <span className={cn("inline-flex items-center gap-0.5 font-medium", proto.color)}>
              <ProtoIcon className="size-2.5" />
              {proto.label}
            </span>
            <span className="text-muted-foreground/20">&middot;</span>
            <span>{channelCfg.label}</span>
            {meter.lastSeenAt && (
              <>
                <span className="text-muted-foreground/20">&middot;</span>
                <span>{formatLastSeen(meter.lastSeenAt)}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick readouts */}
        <div className="hidden shrink-0 items-center gap-4 sm:flex">
          {power && (
            <div className="text-right">
              <p className="font-mono text-base font-bold tabular-nums leading-tight tracking-tight text-foreground">
                {formatPower(power.value)}
              </p>
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">power</p>
            </div>
          )}
          {voltage && !expanded && (
            <div className="text-right">
              <p className="font-mono text-sm font-semibold tabular-nums leading-tight text-foreground/70">
                {formatReadingValue(voltage.value, voltage.metric)}
                <span className="ml-0.5 text-[10px] font-normal text-muted-foreground/50">V</span>
              </p>
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/40">voltage</p>
            </div>
          )}
        </div>

        <RiArrowRightSLine
          className={cn(
            "size-4 shrink-0 text-muted-foreground/25 transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-border/30">
          {/* Mode toggle tabs */}
          <div className="flex items-center gap-0 border-b border-border/20 px-4">
            <TabButton
              active={mode === "readings"}
              onClick={() => setMode("readings")}
              icon={<RiPulseLine className="size-3" />}
              label="Readings"
            />
            <TabButton
              active={mode === "configure"}
              onClick={() => setMode("configure")}
              icon={<RiSettings3Line className="size-3" />}
              label="Configure"
            />
          </div>

          {mode === "readings" ? (
            <ReadingsPanel meter={meter} />
          ) : (
            <ConfigurePanel meter={meter} siteId={siteId} onSaved={onMutate} />
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-border/20 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2.5 text-xs text-muted-foreground">
                <RiRefreshLine className="size-3" />
                Ping
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2.5 text-xs text-destructive/70 hover:bg-destructive/5 hover:text-destructive"
              onClick={async (e) => {
                e.stopPropagation()
                if (!confirm(`Remove meter ${meter.serialNumber}?`)) return
                try {
                  await fetcher(["meter.delete", { siteId, id: meter.id }])
                  toast.success("Meter removed")
                  onMutate?.()
                } catch (err: any) {
                  toast.error(err?.message || "Failed to remove meter")
                }
              }}
            >
              <RiDeleteBinLine className="size-3" />
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Tab Button ---

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground/60 hover:text-muted-foreground",
      )}
    >
      {icon}
      {label}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-foreground" />
      )}
    </button>
  )
}

// --- Readings Empty State ---

const GHOST_METRICS = [
  { metric: "power_w", unit: "W", primary: true },
  { metric: "energy_kwh", unit: "kWh", primary: true },
  { metric: "voltage_v", unit: "V", primary: false },
  { metric: "current_a", unit: "A", primary: false },
  { metric: "frequency", unit: "Hz", primary: false },
  { metric: "pf", unit: "", primary: false },
] as const

function ReadingsEmptyState({
  channel,
  isOnline,
  protocol,
}: {
  channel: MeterChannel
  isOnline: boolean
  protocol: MeterProtocol
}) {
  const channelCfg = CHANNEL_CONFIG[channel]
  const protoCfg = PROTOCOL_CONFIG[protocol]

  return (
    <div className="relative">
      {/* Ghost metric grid — skeletal placeholders */}
      <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-6">
        {GHOST_METRICS.map((g, i) => (
          <div
            key={g.metric}
            className={cn(
              "rounded-lg px-3 py-2.5",
              g.primary
                ? "border border-dashed border-border/30 bg-card/50"
                : "border border-dashed border-transparent bg-muted/15",
            )}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/25">
              {formatMetricLabel(g.metric)}
            </p>
            <div className="mt-1.5 flex items-baseline gap-1">
              <div className={cn(
                "h-4 rounded-sm bg-muted-foreground/[0.06]",
                g.primary ? "w-14" : "w-10",
              )} />
              {g.unit && (
                <span className="text-[9px] text-muted-foreground/15">{g.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Overlay message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/95 px-5 py-3.5 shadow-sm backdrop-blur-sm">
          {isOnline ? (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <p className="text-xs font-semibold text-foreground/80">
                  Awaiting first reading
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground/50">
                Meter is online via {protoCfg.label} — data will appear shortly
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className={cn("flex size-5 items-center justify-center rounded-md", channelCfg.bg)}>
                  <RiPulseLine className={cn("size-3", channelCfg.color, "opacity-40")} />
                </div>
                <p className="text-xs font-semibold text-muted-foreground/70">
                  No readings yet
                </p>
              </div>
              <p className="max-w-[220px] text-center text-[11px] leading-relaxed text-muted-foreground/40">
                Configure your meter to push data via {protoCfg.label} — check the Configure tab for connection details
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Readings Panel ---

function ReadingsPanel({ meter }: { meter: Meter }) {
  const proto = PROTOCOL_CONFIG[meter.protocol]
  const readings = meter.latestReadings ?? []
  const config = meter.config ?? {}
  const channelCfg = CHANNEL_CONFIG[meter.channel]

  return (
    <>
      {/* Live Readings */}
      <div className="bg-muted/5 px-4 py-4">
        <div className="mb-2.5 flex items-center gap-1.5">
          <RiPulseLine className="size-3 text-muted-foreground/40" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
            Readings
          </p>
          {meter.isOnline && (
            <span className="relative ml-1 flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
          )}
        </div>
        {readings.length === 0 ? (
          <ReadingsEmptyState channel={meter.channel} isOnline={meter.isOnline} protocol={meter.protocol} />
        ) : (
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-6">
            {readings.map((reading) => {
              const isPrimary = reading.metric === "power_w" || reading.metric === "energy_kwh"
              return (
                <div
                  key={reading.metric}
                  className={cn(
                    "rounded-lg px-3 py-2.5",
                    isPrimary
                      ? "border border-border/40 bg-card shadow-sm"
                      : "border border-transparent bg-muted/30",
                  )}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                    {formatMetricLabel(reading.metric)}
                  </p>
                  <p className={cn(
                    "mt-1 font-mono tabular-nums leading-none tracking-tight",
                    isPrimary ? "text-base font-bold" : "text-sm font-semibold text-foreground/80",
                  )}>
                    {formatReadingValue(reading.value, reading.metric)}
                    <span className={cn(
                      "ml-1 font-sans font-normal",
                      isPrimary ? "text-[10px] text-muted-foreground/60" : "text-[9px] text-muted-foreground/40",
                    )}>
                      {reading.unit}
                    </span>
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Connection summary */}
      <div className="border-t border-border/20 px-4 py-4">
        <div className="mb-2.5 flex items-center gap-1.5">
          <RiSettings3Line className="size-3 text-muted-foreground/40" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
            Connection
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 lg:grid-cols-4">
          <InfoRow label="Serial" value={meter.serialNumber} mono />
          <InfoRow label="Protocol" value={proto.label} />
          <InfoRow label="Phase" value={meter.phase > 0 ? `L${meter.phase}` : "N/A"} />
          {Object.entries(config).map(([key, value]) => (
            <InfoRow key={key} label={key.replace(/_/g, " ")} value={value} mono={key === "topic" || key === "broker"} />
          ))}
        </div>
      </div>
    </>
  )
}

// --- Configure Panel ---

function ConfigurePanel({ meter, siteId, onSaved }: { meter: Meter; siteId: string; onSaved?: () => void }) {
  const [name, setName] = useState(meter.name)
  const [serialNumber, setSerialNumber] = useState(meter.serialNumber)
  const [channel, setChannel] = useState<MeterChannel>(meter.channel)
  const [phase, setPhase] = useState(meter.phase)
  const [saving, setSaving] = useState(false)

  const proto = PROTOCOL_CONFIG[meter.protocol]
  const ProtoIcon = proto.icon
  const config = meter.config ?? {}
  const allChannels: MeterChannel[] = ["pv", "grid", "battery", "ev", "load"]

  async function handleSave() {
    setSaving(true)
    try {
      await fetcher(["meter.update", {
        siteId,
        id: meter.id,
        name,
        serialNumber,
        phase,
        channel,
      }])
      toast.success("Meter updated", {
        description: `${name || serialNumber} · ${CHANNEL_CONFIG[channel].label} · ${PHASE_OPTIONS.find((p) => p.value === phase)?.label}`,
      })
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.message || "Failed to update meter")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="space-y-4">
        {/* Name */}
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Grid Meter"
            className="mt-1.5"
          />
          <p className="mt-1 text-[11px] text-muted-foreground/40">
            Optional display name — defaults to serial number
          </p>
        </div>

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
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {allChannels.map((ch) => {
              const config = CHANNEL_CONFIG[ch]
              const Icon = config.icon
              const isActive = channel === ch
              return (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                    isActive
                      ? "border-foreground/20 bg-foreground/5 text-foreground shadow-sm"
                      : "border-border/60 text-muted-foreground/70 hover:border-foreground/20 hover:bg-muted/50",
                  )}
                >
                  <Icon className={cn("size-3", isActive ? config.color : "")} />
                  {config.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Phase */}
        <div>
          <Label className="text-xs text-muted-foreground">Phase</Label>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {PHASE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPhase(opt.value)}
                className={cn(
                  "flex flex-col items-center rounded-lg border px-2 py-2 transition-all",
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

        {/* Connection Info — read-only */}
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold", proto.bg, proto.color)}>
              <ProtoIcon className="size-3" />
              {proto.label}
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
              Connection Info
            </p>
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/5 p-3">
            {meter.protocol === "mqtt" ? (
              <div className="space-y-2.5">
                <CopyableField
                  label="Broker"
                  value={config.broker || ANERTIC_MQTT_BROKER}
                />
                <CopyableField
                  label="Topic"
                  value={config.topic || `meters/${meter.serialNumber}/telemetry`}
                />
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">QoS</p>
                    <p className="mt-0.5 font-mono text-sm">{config.qos || "1"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <CopyableField
                  label="Webhook URL"
                  value={`${ANERTIC_INGEST_URL}/${meter.serialNumber}`}
                />
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">Method</p>
                    <p className="mt-0.5 font-mono text-sm">POST</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">Content-Type</p>
                    <p className="mt-0.5 font-mono text-sm">application/json</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/40">
            Protocol cannot be changed after creation.
          </p>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <RiLoader4Line className="mr-1.5 size-3 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Shared sub-components ---

export function CopyableField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 font-mono text-xs select-all">
          {value}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value)
            toast.success(`${label} copied`)
          }}
        >
          <RiClipboardLine className="size-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">{label}</p>
      <p className={cn("mt-0.5 text-sm", mono && "font-mono text-xs")}>{value}</p>
    </div>
  )
}

// --- Helpers ---

export function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`
  return `${watts.toFixed(0)} W`
}

export function formatReadingValue(value: number, metric: string): string {
  if (metric === "pf") return value.toFixed(2)
  if (metric === "energy_kwh") return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (metric === "frequency") return value.toFixed(2)
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return value.toFixed(1)
}

export function formatMetricLabel(metric: string): string {
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

export { formatLastSeen }
