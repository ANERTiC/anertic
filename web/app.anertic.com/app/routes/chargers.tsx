import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import {
  RiAddLine,
  RiChargingPile2Line,
  RiChargingPileLine,
  RiSearchLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiFlashlightLine,
  RiTimeLine,
  RiPlugLine,
  RiLoopLeftLine,
  RiAlertLine,
  RiArrowRightSLine,
} from "@remixicon/react"

import { useSiteId } from "~/layouts/site"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

// --- Types ---

interface Charger {
  id: string
  siteId: string
  chargePointId: string
  ocppVersion: string
  status: string
  registrationStatus: string
  connectorCount: number
  maxPowerKw: number
  vendor: string
  model: string
  serialNumber: string
  firmwareVersion: string
  lastHeartbeatAt: string | null
  createdAt: string
  currentPowerKw: number
  sessionEnergyKwh: number
  todayEnergyKwh: number
  todaySessions: number
  uptimePercent: number
  connectors: ConnectorStatus[]
}

interface ConnectorStatus {
  id: number
  status: string
  powerKw: number
  vehicleId?: string
  sessionStartedAt?: string
  sessionKwh: number
  errorCode?: string
}

interface FleetSummary {
  total: number
  charging: number
  available: number
  faulted: number
  offline: number
  totalPowerKw: number
  maxCapacityKw: number
  todayEnergyKwh: number
  todaySessions: number
  avgSessionKwh: number
  utilizationPercent: number
}


// --- Mock Data ---

function generateMockChargers(): Charger[] {
  return [
    {
      id: "chr-1",
      siteId: "site-1",
      chargePointId: "CP-001",
      ocppVersion: "1.6",
      status: "Charging",
      registrationStatus: "Accepted",
      connectorCount: 2,
      maxPowerKw: 22,
      vendor: "ABB",
      model: "Terra AC W22-T-RD-M-0",
      serialNumber: "ABB-2024-001",
      firmwareVersion: "3.8.1",
      lastHeartbeatAt: new Date(Date.now() - 15000).toISOString(),
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      currentPowerKw: 18.4,
      sessionEnergyKwh: 14.3,
      todayEnergyKwh: 48.2,
      todaySessions: 4,
      uptimePercent: 99.2,
      connectors: [
        {
          id: 1,
          status: "Charging",
          powerKw: 11.2,
          vehicleId: "Tesla Model 3",
          sessionStartedAt: new Date(Date.now() - 3600000).toISOString(),
          sessionKwh: 9.8,
        },
        {
          id: 2,
          status: "Charging",
          powerKw: 7.2,
          vehicleId: "BYD Atto 3",
          sessionStartedAt: new Date(Date.now() - 1800000).toISOString(),
          sessionKwh: 4.5,
        },
      ],
    },
    {
      id: "chr-2",
      siteId: "site-1",
      chargePointId: "CP-002",
      ocppVersion: "2.0.1",
      status: "Charging",
      registrationStatus: "Accepted",
      connectorCount: 2,
      maxPowerKw: 50,
      vendor: "Wallbox",
      model: "Supernova DC",
      serialNumber: "WB-2024-002",
      firmwareVersion: "2.1.4",
      lastHeartbeatAt: new Date(Date.now() - 8000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      currentPowerKw: 43.6,
      sessionEnergyKwh: 22.1,
      todayEnergyKwh: 112.8,
      todaySessions: 7,
      uptimePercent: 97.8,
      connectors: [
        {
          id: 1,
          status: "Charging",
          powerKw: 43.6,
          vehicleId: "MG ZS EV",
          sessionStartedAt: new Date(Date.now() - 2400000).toISOString(),
          sessionKwh: 22.1,
        },
        {
          id: 2,
          status: "Available",
          powerKw: 0,
          sessionKwh: 0,
        },
      ],
    },
    {
      id: "chr-3",
      siteId: "site-1",
      chargePointId: "CP-003",
      ocppVersion: "1.6",
      status: "Available",
      registrationStatus: "Accepted",
      connectorCount: 2,
      maxPowerKw: 22,
      vendor: "ABB",
      model: "Terra AC W22-T-RD-M-0",
      serialNumber: "ABB-2024-003",
      firmwareVersion: "3.8.1",
      lastHeartbeatAt: new Date(Date.now() - 45000).toISOString(),
      createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
      currentPowerKw: 0,
      sessionEnergyKwh: 0,
      todayEnergyKwh: 31.5,
      todaySessions: 3,
      uptimePercent: 99.8,
      connectors: [
        { id: 1, status: "Available", powerKw: 0, sessionKwh: 0 },
        { id: 2, status: "Available", powerKw: 0, sessionKwh: 0 },
      ],
    },
    {
      id: "chr-4",
      siteId: "site-1",
      chargePointId: "CP-004",
      ocppVersion: "1.6",
      status: "Faulted",
      registrationStatus: "Accepted",
      connectorCount: 1,
      maxPowerKw: 7.4,
      vendor: "Delta",
      model: "AC Mini Plus",
      serialNumber: "DL-2024-004",
      firmwareVersion: "1.2.0",
      lastHeartbeatAt: null,
      createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
      currentPowerKw: 0,
      sessionEnergyKwh: 0,
      todayEnergyKwh: 0,
      todaySessions: 0,
      uptimePercent: 12.3,
      connectors: [
        {
          id: 1,
          status: "Faulted",
          powerKw: 0,
          sessionKwh: 0,
          errorCode: "GroundFailure",
        },
      ],
    },
    {
      id: "chr-5",
      siteId: "site-1",
      chargePointId: "CP-005",
      ocppVersion: "2.0.1",
      status: "SuspendedEV",
      registrationStatus: "Accepted",
      connectorCount: 2,
      maxPowerKw: 22,
      vendor: "Schneider",
      model: "EVlink Pro AC",
      serialNumber: "SE-2024-005",
      firmwareVersion: "4.0.2",
      lastHeartbeatAt: new Date(Date.now() - 60000).toISOString(),
      createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      currentPowerKw: 0,
      sessionEnergyKwh: 18.4,
      todayEnergyKwh: 18.4,
      todaySessions: 1,
      uptimePercent: 94.5,
      connectors: [
        {
          id: 1,
          status: "SuspendedEV",
          powerKw: 0,
          vehicleId: "Nissan Leaf",
          sessionStartedAt: new Date(Date.now() - 7200000).toISOString(),
          sessionKwh: 18.4,
        },
        { id: 2, status: "Available", powerKw: 0, sessionKwh: 0 },
      ],
    },
    {
      id: "chr-6",
      siteId: "site-1",
      chargePointId: "CP-006",
      ocppVersion: "1.6",
      status: "Preparing",
      registrationStatus: "Accepted",
      connectorCount: 1,
      maxPowerKw: 22,
      vendor: "ABB",
      model: "Terra AC W22-T-RD-M-0",
      serialNumber: "ABB-2024-006",
      firmwareVersion: "3.8.1",
      lastHeartbeatAt: new Date(Date.now() - 5000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      currentPowerKw: 0,
      sessionEnergyKwh: 0,
      todayEnergyKwh: 22.1,
      todaySessions: 2,
      uptimePercent: 98.6,
      connectors: [{ id: 1, status: "Preparing", powerKw: 0, sessionKwh: 0 }],
    },
  ]
}

function computeFleetSummary(chargers: Charger[]): FleetSummary {
  const charging = chargers.filter(
    (c) => c.status === "Charging" || c.status === "Preparing",
  ).length
  const available = chargers.filter((c) => c.status === "Available").length
  const faulted = chargers.filter((c) => c.status === "Faulted").length
  const offline = chargers.filter((c) => !c.lastHeartbeatAt).length
  const totalPowerKw = chargers.reduce((s, c) => s + c.currentPowerKw, 0)
  const maxCapacityKw = chargers.reduce((s, c) => s + c.maxPowerKw, 0)
  const todayEnergyKwh = chargers.reduce((s, c) => s + c.todayEnergyKwh, 0)
  const todaySessions = chargers.reduce((s, c) => s + c.todaySessions, 0)

  return {
    total: chargers.length,
    charging,
    available,
    faulted,
    offline,
    totalPowerKw,
    maxCapacityKw,
    todayEnergyKwh,
    todaySessions,
    avgSessionKwh: todaySessions > 0 ? todayEnergyKwh / todaySessions : 0,
    utilizationPercent:
      maxCapacityKw > 0 ? (totalPowerKw / maxCapacityKw) * 100 : 0,
  }
}

// --- Helpers ---

function statusColor(status: string) {
  switch (status) {
    case "Available":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    case "Charging":
    case "Preparing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400"
    case "SuspendedEV":
    case "SuspendedEVSE":
    case "Finishing":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    case "Faulted":
      return "bg-red-500/15 text-red-700 dark:text-red-400"
    case "Reserved":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400"
    default:
      return "bg-gray-500/15 text-gray-700 dark:text-gray-400"
  }
}

function statusDot(status: string) {
  switch (status) {
    case "Available":
      return "bg-emerald-500"
    case "Charging":
    case "Preparing":
      return "bg-blue-500"
    case "SuspendedEV":
    case "SuspendedEVSE":
    case "Finishing":
      return "bg-amber-500"
    case "Faulted":
      return "bg-red-500"
    default:
      return "bg-gray-400"
  }
}

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

function formatPower(kw: number): string {
  if (kw >= 100) return `${Math.round(kw)} kW`
  if (kw >= 10) return `${kw.toFixed(1)} kW`
  return `${kw.toFixed(2)} kW`
}

function formatEnergy(kwh: number): string {
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(1)} MWh`
  if (kwh >= 100) return `${Math.round(kwh)} kWh`
  return `${kwh.toFixed(1)} kWh`
}

function sessionDuration(startedAt?: string): string {
  if (!startedAt) return ""
  const diff = Date.now() - new Date(startedAt).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

// --- Main Component ---

export default function Chargers() {
  const navigate = useNavigate()
  const siteId = useSiteId()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // TODO: Replace with API call when backend is ready
  // const { data, isLoading, mutate } = useSWR(
  //   siteId ? ["charger.list", siteId] : null,
  //   () => api<{ items: Charger[] }>("charger.list", { siteId }),
  // )
  const [chargers] = useState<Charger[]>(() => generateMockChargers())

  useEffect(() => {
    setMounted(true)
  }, [])

  const filtered = chargers.filter((c) => {
    const matchesSearch =
      !search ||
      c.chargePointId.toLowerCase().includes(search.toLowerCase()) ||
      c.vendor.toLowerCase().includes(search.toLowerCase()) ||
      c.model.toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      !statusFilter ||
      (statusFilter === "Charging" &&
        (c.status === "Charging" || c.status === "Preparing")) ||
      (statusFilter === "Faulted" && c.status === "Faulted") ||
      (statusFilter === "Available" && c.status === "Available") ||
      (statusFilter === "Other" &&
        !["Charging", "Preparing", "Faulted", "Available"].includes(c.status))

    return matchesSearch && matchesStatus
  })

  const fleet = computeFleetSummary(chargers)


  return (
    <div
      className={cn(
        "space-y-5 transition-opacity duration-500",
        mounted ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Chargers</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Fleet management and monitoring
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => navigate(`/chargers/new?site=${siteId}`)}>
          <RiAddLine className="size-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Add Charger</span>
        </Button>
      </div>

      {/* Fleet Summary Strip */}
      <Card className="overflow-hidden py-0">

        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-6">
            <FleetCell
              icon={RiFlashlightLine}
              label="Live Power"
              value={formatPower(fleet.totalPowerKw)}
              sub={`of ${formatPower(fleet.maxCapacityKw)} capacity`}
              color="cyan"
            />
            <FleetCell
              icon={RiChargingPile2Line}
              label="Today"
              value={formatEnergy(fleet.todayEnergyKwh)}
              sub={`${fleet.todaySessions} sessions`}
              color="amber"
            />
            <FleetCell
              icon={RiLoopLeftLine}
              label="Utilization"
              value={`${fleet.utilizationPercent.toFixed(0)}%`}
              sub={`${fleet.charging} of ${fleet.total} active`}
              color="violet"
            />
            <FleetCell
              icon={RiChargingPileLine}
              label="Available"
              value={String(fleet.available)}
              sub="ready to charge"
              color="emerald"
            />
            <FleetCell
              icon={RiAlertLine}
              label="Faulted"
              value={String(fleet.faulted)}
              sub={fleet.faulted > 0 ? "needs attention" : "all healthy"}
              color={fleet.faulted > 0 ? "red" : "emerald"}
            />
            <FleetCell
              icon={RiPlugLine}
              label="Avg Session"
              value={`${fleet.avgSessionKwh.toFixed(1)} kWh`}
              sub="per charge"
              color="blue"
            />
          </div>
        </CardContent>
      </Card>

      {/* Search + Filter */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
        <div className="relative flex-1">
          <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chargers..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {[
            { label: "All", value: null, count: fleet.total },
            { label: "Charging", value: "Charging", count: fleet.charging },
            { label: "Available", value: "Available", count: fleet.available },
            { label: "Faulted", value: "Faulted", count: fleet.faulted },
          ].map((f) => (
            <button
              key={f.label}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
              <span className="ml-1 tabular-nums opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Charger Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <RiChargingPileLine className="mb-3 size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter
              ? "No chargers match your filters"
              : "No chargers registered yet"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((charger) => (
            <ChargerCard
              key={charger.id}
              charger={charger}
              onClick={() =>
                navigate(`/chargers/${charger.id}?site=${siteId}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function FleetCell({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof RiFlashlightLine
  label: string
  value: string
  sub: string
  color: string
}) {
  const colorMap: Record<string, { text: string; bg: string }> = {
    amber: { text: "text-amber-700", bg: "from-amber-50" },
    emerald: { text: "text-emerald-700", bg: "from-emerald-50" },
    violet: { text: "text-violet-700", bg: "from-violet-50" },
    blue: { text: "text-blue-700", bg: "from-blue-50" },
    cyan: { text: "text-cyan-700", bg: "from-cyan-50" },
    red: { text: "text-red-700", bg: "from-red-50" },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="relative px-4 py-3.5">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br to-transparent",
          c.bg,
        )}
      />
      <div className="relative">
        <div
          className={cn(
            "flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider opacity-70",
            c.text,
          )}
        >
          <Icon className="size-3" />
          {label}
        </div>
        <p
          className={cn(
            "mt-1.5 text-lg font-bold tabular-nums tracking-tight",
            c.text,
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  )
}

function ChargerCard({
  charger,
  onClick,
}: {
  charger: Charger
  onClick: () => void
}) {
  const isCharging =
    charger.status === "Charging" || charger.status === "Preparing"
  const isFaulted = charger.status === "Faulted"
  const isOnline = !!charger.lastHeartbeatAt
  const powerPercent =
    charger.maxPowerKw > 0
      ? (charger.currentPowerKw / charger.maxPowerKw) * 100
      : 0

  return (
    <Card
      className={cn(
        "group h-full cursor-pointer overflow-hidden py-0 transition-all hover:shadow-md",
        isFaulted && "border-red-200",
      )}
      onClick={onClick}
    >
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex flex-1 flex-col p-4">
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  {isCharging && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  )}
                  {isFaulted && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex size-2.5 rounded-full",
                      statusDot(charger.status),
                    )}
                  />
                </span>
                <h3 className="text-base font-semibold tracking-tight">
                  {charger.chargePointId}
                </h3>
                <Badge
                  className={cn("text-[10px]", statusColor(charger.status))}
                >
                  {charger.status}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {charger.vendor} {charger.model}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {isOnline ? (
                  <RiSignalWifiLine className="size-3 text-emerald-500" />
                ) : (
                  <RiSignalWifiOffLine className="size-3 text-red-400" />
                )}
                <span className="tabular-nums">
                  {timeAgo(charger.lastHeartbeatAt)}
                </span>
              </div>
              <RiArrowRightSLine className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </div>

          {/* Connectors */}
          <div className="mt-3 flex-1 space-y-2">
            {charger.connectors.map((conn) => (
              <ConnectorRow key={conn.id} connector={conn} />
            ))}
          </div>

          {/* Bottom stats */}
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 tabular-nums">
                <RiFlashlightLine className="size-3" />
                {formatEnergy(charger.todayEnergyKwh)} today
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <RiLoopLeftLine className="size-3" />
                {charger.todaySessions} sessions
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="tabular-nums">
                OCPP {charger.ocppVersion}
              </span>
              <span>&middot;</span>
              <span className="tabular-nums">{charger.maxPowerKw} kW</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ConnectorRow({ connector }: { connector: ConnectorStatus }) {
  const isActive =
    connector.status === "Charging" || connector.status === "Preparing"
  const isSuspended =
    connector.status === "SuspendedEV" || connector.status === "SuspendedEVSE"
  const isFaulted = connector.status === "Faulted"

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2",
        isActive && "border-blue-200 bg-blue-50/50",
        isSuspended && "border-amber-200 bg-amber-50/30",
        isFaulted && "border-red-200 bg-red-50/30",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="relative">
          <RiPlugLine className="size-4 text-muted-foreground" />
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-white",
              statusDot(connector.status),
            )}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          #{connector.id}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {connector.vehicleId ? (
          <p className="truncate text-xs font-medium">{connector.vehicleId}</p>
        ) : isFaulted && connector.errorCode ? (
          <p className="truncate text-xs font-medium text-red-600">
            {connector.errorCode}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {connector.status === "Available" ? "Ready" : connector.status}
          </p>
        )}
      </div>

      {isActive && (
        <div className="flex items-center gap-3 text-xs tabular-nums">
          <span className="font-semibold text-blue-700">
            {formatPower(connector.powerKw)}
          </span>
          <span className="text-muted-foreground">
            {connector.sessionKwh.toFixed(1)} kWh
          </span>
        </div>
      )}
      {isSuspended && connector.sessionKwh > 0 && (
        <div className="flex items-center gap-2 text-xs tabular-nums">
          <span className="text-amber-600">Paused</span>
          <span className="text-muted-foreground">
            {connector.sessionKwh.toFixed(1)} kWh
          </span>
        </div>
      )}
      {connector.sessionStartedAt && (isActive || isSuspended) && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <RiTimeLine className="size-3" />
          {sessionDuration(connector.sessionStartedAt)}
        </span>
      )}
    </div>
  )
}
