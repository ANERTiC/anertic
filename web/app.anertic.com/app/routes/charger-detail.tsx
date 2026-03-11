import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import {
  RiArrowLeftLine,
  RiFlashlightLine,
  RiPlugLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiTimeLine,
  RiLoopLeftLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiBattery2ChargeLine,
  RiSettings3Line,
  RiHistoryLine,
  RiInformationLine,
  RiRestartLine,
  RiShutDownLine,
} from "@remixicon/react"

import { useSiteId } from "~/layouts/site"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
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
  chargeBoxSerialNumber: string
  firmwareStatus: string
  diagnosticsStatus: string
  heartbeatInterval: number
  lastHeartbeatAt: string | null
  createdAt: string
  // Extended
  currentPowerKw: number
  todayEnergyKwh: number
  todaySessions: number
  totalEnergyKwh: number
  totalSessions: number
  uptimePercent: number
  connectors: ConnectorDetail[]
}

interface ConnectorDetail {
  id: number
  status: string
  powerKw: number
  maxPowerKw: number
  connectorType: string
  errorCode: string
  vehicleId?: string
  sessionStartedAt?: string
  sessionKwh: number
  lastStatusAt: string | null
}

interface Session {
  id: string
  connectorId: number
  startedAt: string
  endedAt: string | null
  energyKwh: number
  maxPowerKw: number
  vehicleId?: string
  status: string
}

interface OcppEvent {
  id: string
  action: string
  direction: "in" | "out"
  timestamp: string
  payload?: string
}

// --- Mock Data ---

function generateMockCharger(id: string): Charger {
  return {
    id,
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
    chargeBoxSerialNumber: "CB-ABB-2024-001",
    firmwareStatus: "Installed",
    diagnosticsStatus: "Idle",
    heartbeatInterval: 60,
    lastHeartbeatAt: new Date(Date.now() - 15000).toISOString(),
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    currentPowerKw: 18.4,
    todayEnergyKwh: 48.2,
    todaySessions: 4,
    totalEnergyKwh: 4218.7,
    totalSessions: 312,
    uptimePercent: 99.2,
    connectors: [
      {
        id: 1,
        status: "Charging",
        powerKw: 11.2,
        maxPowerKw: 22,
        connectorType: "Type 2",
        errorCode: "NoError",
        vehicleId: "Tesla Model 3",
        sessionStartedAt: new Date(Date.now() - 3600000).toISOString(),
        sessionKwh: 9.8,
        lastStatusAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 2,
        status: "Charging",
        powerKw: 7.2,
        maxPowerKw: 22,
        connectorType: "Type 2",
        errorCode: "NoError",
        vehicleId: "BYD Atto 3",
        sessionStartedAt: new Date(Date.now() - 1800000).toISOString(),
        sessionKwh: 4.5,
        lastStatusAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
  }
}

function generateMockSessions(): Session[] {
  const now = Date.now()
  return [
    {
      id: "ses-1",
      connectorId: 1,
      startedAt: new Date(now - 3600000).toISOString(),
      endedAt: null,
      energyKwh: 9.8,
      maxPowerKw: 11.2,
      vehicleId: "Tesla Model 3",
      status: "Active",
    },
    {
      id: "ses-2",
      connectorId: 2,
      startedAt: new Date(now - 1800000).toISOString(),
      endedAt: null,
      energyKwh: 4.5,
      maxPowerKw: 7.2,
      vehicleId: "BYD Atto 3",
      status: "Active",
    },
    {
      id: "ses-3",
      connectorId: 1,
      startedAt: new Date(now - 14400000).toISOString(),
      endedAt: new Date(now - 10800000).toISOString(),
      energyKwh: 18.6,
      maxPowerKw: 22.0,
      vehicleId: "Hyundai Ioniq 5",
      status: "Completed",
    },
    {
      id: "ses-4",
      connectorId: 2,
      startedAt: new Date(now - 21600000).toISOString(),
      endedAt: new Date(now - 18000000).toISOString(),
      energyKwh: 12.3,
      maxPowerKw: 11.0,
      status: "Completed",
    },
    {
      id: "ses-5",
      connectorId: 1,
      startedAt: new Date(now - 86400000).toISOString(),
      endedAt: new Date(now - 82800000).toISOString(),
      energyKwh: 7.1,
      maxPowerKw: 7.4,
      vehicleId: "Nissan Leaf",
      status: "Completed",
    },
    {
      id: "ses-6",
      connectorId: 2,
      startedAt: new Date(now - 90000000).toISOString(),
      endedAt: new Date(now - 86400000).toISOString(),
      energyKwh: 22.0,
      maxPowerKw: 22.0,
      vehicleId: "MG ZS EV",
      status: "Completed",
    },
  ]
}

function generateMockEvents(): OcppEvent[] {
  const now = Date.now()
  return [
    { id: "ev-1", action: "Heartbeat", direction: "in", timestamp: new Date(now - 15000).toISOString() },
    { id: "ev-2", action: "MeterValues", direction: "in", timestamp: new Date(now - 30000).toISOString(), payload: "connectorId=1, power=11.2kW" },
    { id: "ev-3", action: "MeterValues", direction: "in", timestamp: new Date(now - 30000).toISOString(), payload: "connectorId=2, power=7.2kW" },
    { id: "ev-4", action: "StatusNotification", direction: "in", timestamp: new Date(now - 1800000).toISOString(), payload: "connector=2, status=Charging" },
    { id: "ev-5", action: "StartTransaction", direction: "in", timestamp: new Date(now - 1800000).toISOString(), payload: "connectorId=2, idTag=BYD-ATTO3" },
    { id: "ev-6", action: "StatusNotification", direction: "in", timestamp: new Date(now - 3600000).toISOString(), payload: "connector=1, status=Charging" },
    { id: "ev-7", action: "StartTransaction", direction: "in", timestamp: new Date(now - 3600000).toISOString(), payload: "connectorId=1, idTag=TESLA-M3" },
    { id: "ev-8", action: "StopTransaction", direction: "in", timestamp: new Date(now - 10800000).toISOString(), payload: "transactionId=312, meterStop=18600" },
    { id: "ev-9", action: "Heartbeat", direction: "in", timestamp: new Date(now - 60000).toISOString() },
    { id: "ev-10", action: "RemoteStartTransaction", direction: "out", timestamp: new Date(now - 3700000).toISOString(), payload: "connectorId=1, idTag=TESLA-M3" },
  ]
}

// --- Helpers ---

function statusColor(status: string) {
  switch (status) {
    case "Available":
      return "bg-emerald-500/15 text-emerald-700"
    case "Charging":
    case "Preparing":
      return "bg-blue-500/15 text-blue-700"
    case "SuspendedEV":
    case "SuspendedEVSE":
    case "Finishing":
      return "bg-amber-500/15 text-amber-700"
    case "Faulted":
      return "bg-red-500/15 text-red-700"
    case "Reserved":
      return "bg-purple-500/15 text-purple-700"
    default:
      return "bg-gray-500/15 text-gray-700"
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

function registrationColor(status: string) {
  switch (status) {
    case "Accepted":
      return "bg-emerald-500/15 text-emerald-700"
    case "Pending":
      return "bg-amber-500/15 text-amber-700"
    case "Rejected":
      return "bg-red-500/15 text-red-700"
    default:
      return "bg-gray-500/15 text-gray-700"
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

function sessionDuration(startedAt: string, endedAt?: string | null): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diff = end - new Date(startedAt).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// --- Main Component ---

export default function ChargerDetail() {
  const { chargerId } = useParams()
  const navigate = useNavigate()
  const siteId = useSiteId()
  const [mounted, setMounted] = useState(false)

  // TODO: Replace with API calls when backend is ready
  // const { data: charger, isLoading } = useSWR(
  //   chargerId ? ["charger.get", chargerId] : null,
  //   () => api<Charger>("charger.get", { id: chargerId }),
  // )
  const [charger] = useState<Charger>(() =>
    generateMockCharger(chargerId || ""),
  )
  const [sessions] = useState<Session[]>(() => generateMockSessions())
  const [events] = useState<OcppEvent[]>(() => generateMockEvents())

  useEffect(() => {
    setMounted(true)
  }, [])

  const isCharging =
    charger.status === "Charging" || charger.status === "Preparing"
  const isFaulted = charger.status === "Faulted"
  const isOnline = !!charger.lastHeartbeatAt

  const activeSessions = sessions.filter((s) => s.status === "Active")
  const completedSessions = sessions.filter((s) => s.status === "Completed")

  return (
    <div
      className={cn(
        "space-y-5 transition-opacity duration-500",
        mounted ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() =>
              navigate(`/chargers${siteId ? `?site=${siteId}` : ""}`)
            }
          >
            <RiArrowLeftLine className="mr-1 size-4" />
            Chargers
          </Button>
          <div className="flex items-center gap-3">
            <span className="relative flex size-3">
              {isCharging && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
              )}
              {isFaulted && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              )}
              <span
                className={cn(
                  "relative inline-flex size-3 rounded-full",
                  statusDot(charger.status),
                )}
              />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {charger.chargePointId}
            </h1>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Badge className={cn("text-[10px]", statusColor(charger.status))}>
              {charger.status}
            </Badge>
            <Badge
              className={cn(
                "text-[10px]",
                registrationColor(charger.registrationStatus),
              )}
            >
              {charger.registrationStatus}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {isOnline ? (
                <RiSignalWifiLine className="size-3 text-emerald-500" />
              ) : (
                <RiSignalWifiOffLine className="size-3 text-red-400" />
              )}
              {timeAgo(charger.lastHeartbeatAt)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {charger.vendor} {charger.model}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RiRestartLine className="mr-1.5 size-3.5" />
            Reset
          </Button>
          <Button variant="outline" size="sm">
            <RiShutDownLine className="mr-1.5 size-3.5" />
            Reboot
          </Button>
        </div>
      </div>

      {/* Stats Strip */}
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="grid grid-cols-3 divide-x lg:grid-cols-6">
            <StatCell
              icon={RiFlashlightLine}
              label="Live Power"
              value={formatPower(charger.currentPowerKw)}
              sub={`of ${formatPower(charger.maxPowerKw)}`}
              color="cyan"
            />
            <StatCell
              icon={RiBattery2ChargeLine}
              label="Today"
              value={formatEnergy(charger.todayEnergyKwh)}
              sub={`${charger.todaySessions} sessions`}
              color="amber"
            />
            <StatCell
              icon={RiLoopLeftLine}
              label="Uptime"
              value={`${charger.uptimePercent}%`}
              sub="last 30 days"
              color={charger.uptimePercent >= 95 ? "emerald" : "red"}
            />
            <StatCell
              icon={RiHistoryLine}
              label="Total Energy"
              value={formatEnergy(charger.totalEnergyKwh)}
              sub={`${charger.totalSessions} sessions`}
              color="violet"
            />
            <StatCell
              icon={RiPlugLine}
              label="Connectors"
              value={`${charger.connectors.filter((c) => c.status === "Charging").length}/${charger.connectorCount}`}
              sub="active"
              color="blue"
            />
            <StatCell
              icon={RiTimeLine}
              label="Heartbeat"
              value={`${charger.heartbeatInterval}s`}
              sub={timeAgo(charger.lastHeartbeatAt)}
              color="emerald"
            />
          </div>
        </CardContent>
      </Card>

      {/* Connectors */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Connectors
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {charger.connectors.map((conn) => (
            <ConnectorCard key={conn.id} connector={conn} />
          ))}
        </div>
      </div>

      {/* Tabs: Sessions / Info / OCPP Log */}
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">
            <RiHistoryLine className="mr-1.5 size-3.5" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="info">
            <RiInformationLine className="mr-1.5 size-3.5" />
            Device Info
          </TabsTrigger>
          <TabsTrigger value="log">
            <RiSettings3Line className="mr-1.5 size-3.5" />
            OCPP Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <div className="space-y-4">
            {activeSessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Active
                </p>
                {activeSessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            )}
            {completedSessions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recent
                </p>
                {completedSessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="Charge Point ID" value={charger.chargePointId} />
                <InfoRow label="OCPP Version" value={charger.ocppVersion} />
                <InfoRow label="Vendor" value={charger.vendor || "—"} />
                <InfoRow label="Model" value={charger.model || "—"} />
                <InfoRow label="Serial Number" value={charger.serialNumber || "—"} />
                <InfoRow
                  label="Charge Box Serial"
                  value={charger.chargeBoxSerialNumber || "—"}
                />
                <InfoRow
                  label="Firmware"
                  value={charger.firmwareVersion || "—"}
                />
                <InfoRow label="Firmware Status" value={charger.firmwareStatus} />
                <InfoRow
                  label="Diagnostics Status"
                  value={charger.diagnosticsStatus}
                />
                <InfoRow
                  label="Connector Count"
                  value={String(charger.connectorCount)}
                />
                <InfoRow
                  label="Max Power"
                  value={`${charger.maxPowerKw} kW`}
                />
                <InfoRow
                  label="Heartbeat Interval"
                  value={`${charger.heartbeatInterval}s`}
                />
                <InfoRow
                  label="Registered"
                  value={new Date(charger.createdAt).toLocaleDateString([], {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        event.direction === "in"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-amber-500/10 text-amber-600",
                      )}
                    >
                      {event.direction === "in" ? "IN" : "OUT"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {event.action}
                    </span>
                    {event.payload && (
                      <span className="hidden truncate text-xs text-muted-foreground lg:block lg:max-w-[300px]">
                        {event.payload}
                      </span>
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// --- Sub-components ---

function StatCell({
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

function ConnectorCard({ connector }: { connector: ConnectorDetail }) {
  const isActive =
    connector.status === "Charging" || connector.status === "Preparing"
  const isSuspended =
    connector.status === "SuspendedEV" || connector.status === "SuspendedEVSE"
  const isFaulted = connector.status === "Faulted"
  const powerPercent =
    connector.maxPowerKw > 0
      ? (connector.powerKw / connector.maxPowerKw) * 100
      : 0

  return (
    <Card
      className={cn(
        "overflow-hidden",
        isFaulted && "border-red-200",
        isActive && "border-blue-200",
      )}
    >
      <CardContent className="p-0">
        {/* Power usage bar */}
        {isActive && (
          <div className="h-1 bg-blue-100">
            <div
              className="h-full bg-blue-500 transition-all duration-1000"
              style={{ width: `${powerPercent}%` }}
            />
          </div>
        )}
        {isFaulted && <div className="h-1 bg-red-500" />}

        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <RiPlugLine className="size-5 text-muted-foreground" />
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-white",
                    statusDot(connector.status),
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Connector {connector.id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connector.connectorType || "Type 2"} &middot;{" "}
                  {connector.maxPowerKw} kW max
                </p>
              </div>
            </div>
            <Badge
              className={cn("text-[10px]", statusColor(connector.status))}
            >
              {connector.status}
            </Badge>
          </div>

          {/* Active session details */}
          {isActive && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">
                  {connector.vehicleId || "Unknown vehicle"}
                </p>
                {connector.sessionStartedAt && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <RiTimeLine className="size-3" />
                    {sessionDuration(connector.sessionStartedAt)}
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Power</p>
                  <p className="text-lg font-bold tabular-nums text-blue-700">
                    {formatPower(connector.powerKw)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Session Energy
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {connector.sessionKwh.toFixed(1)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      kWh
                    </span>
                  </p>
                </div>
              </div>
              {/* Power bar */}
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Power utilization</span>
                  <span className="tabular-nums">
                    {powerPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                    style={{ width: `${powerPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Suspended session */}
          {isSuspended && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">
                  {connector.vehicleId || "Unknown vehicle"}
                </p>
                <span className="text-[10px] font-medium text-amber-600">
                  Paused
                </span>
              </div>
              <p className="mt-1 text-sm tabular-nums">
                {connector.sessionKwh.toFixed(1)} kWh delivered
              </p>
            </div>
          )}

          {/* Faulted */}
          {isFaulted && connector.errorCode !== "NoError" && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50/30 p-3">
              <div className="flex items-center gap-2">
                <RiAlertLine className="size-4 text-red-500" />
                <p className="text-xs font-medium text-red-700">
                  {connector.errorCode}
                </p>
              </div>
            </div>
          )}

          {/* Available */}
          {connector.status === "Available" && (
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <RiCheckboxCircleLine className="size-4 text-emerald-500" />
              Ready to charge
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SessionRow({ session }: { session: Session }) {
  const isActive = session.status === "Active"

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border px-4 py-3",
        isActive && "border-blue-200 bg-blue-50/30",
      )}
    >
      {/* Status dot */}
      <span className="relative flex size-2.5">
        {isActive && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            isActive ? "bg-blue-500" : "bg-gray-300",
          )}
        />
      </span>

      {/* Connector */}
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <RiPlugLine className="size-3" />#{session.connectorId}
      </span>

      {/* Vehicle */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {session.vehicleId || "Unknown"}
      </span>

      {/* Energy */}
      <span className="text-sm font-semibold tabular-nums">
        {session.energyKwh.toFixed(1)} kWh
      </span>

      {/* Max power */}
      <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
        {formatPower(session.maxPowerKw)} peak
      </span>

      {/* Duration */}
      <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
        <RiTimeLine className="size-3" />
        {sessionDuration(session.startedAt, session.endedAt)}
      </span>

      {/* Time */}
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatTime(session.startedAt)}
      </span>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{value}</dd>
    </div>
  )
}
