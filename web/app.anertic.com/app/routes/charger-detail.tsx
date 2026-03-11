import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router"
import {
  RiArrowLeftLine,
  RiFlashlightLine,
  RiPlugLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiTimeLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiSettings3Line,
  RiHistoryLine,
  RiInformationLine,
  RiRestartLine,
  RiShutDownLine,
  RiEditLine,
  RiDeleteBinLine,
  RiUploadLine,
  RiShieldKeyholeLine,
  RiAddLine,
  RiSaveLine,
  RiBarChartBoxLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { useSiteId } from "~/layouts/site"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
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

interface DailyEnergy {
  date: string
  label: string
  energyKwh: number
  sessions: number
  peakPowerKw: number
  avgSessionKwh: number
  connector1Kwh: number
  connector2Kwh: number
}

interface HourlyPower {
  hour: number
  powerKw: number
  energyKwh: number
}

interface AnalyticsSummary {
  last7DaysKwh: number
  last7DaysSessions: number
  last7DaysAvgDaily: number
  last7DaysAvgSession: number
  last7DaysPeakPower: number
  changePercent: number
  changeDirection: "up" | "down" | "stable"
  bussiestDay: string
  bussiestHour: string
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

function generateMockAnalytics(): {
  daily: DailyEnergy[]
  hourly: HourlyPower[]
  summary: AnalyticsSummary
} {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const now = new Date()
  const currentHour = now.getHours()

  const daily: DailyEnergy[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (6 - i))
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const base = isWeekend ? 25 : 42
    const energy = base + Math.random() * 20 - 5
    const sessions = Math.floor((isWeekend ? 2 : 4) + Math.random() * 3)
    const peak = 11 + Math.random() * 11
    const c1 = energy * (0.45 + Math.random() * 0.15)
    return {
      date: d.toISOString().split("T")[0],
      label: i === 6 ? "Today" : days[d.getDay()],
      energyKwh: parseFloat(energy.toFixed(1)),
      sessions,
      peakPowerKw: parseFloat(peak.toFixed(1)),
      avgSessionKwh: parseFloat((energy / sessions).toFixed(1)),
      connector1Kwh: parseFloat(c1.toFixed(1)),
      connector2Kwh: parseFloat((energy - c1).toFixed(1)),
    }
  })

  const hourly: HourlyPower[] = Array.from({ length: 24 }, (_, hour) => {
    if (hour > currentHour) return { hour, powerKw: 0, energyKwh: 0 }
    // Simulate typical EV charging pattern: morning commuters + afternoon + evening
    const morningPeak = Math.exp(-((hour - 9) ** 2) / 6)
    const afternoonPeak = Math.exp(-((hour - 14) ** 2) / 8)
    const eveningPeak = Math.exp(-((hour - 19) ** 2) / 6)
    const base = 1.5
    const power =
      base +
      morningPeak * 15 +
      afternoonPeak * 10 +
      eveningPeak * 18 +
      Math.random() * 2
    return {
      hour,
      powerKw: parseFloat(Math.min(power, 22).toFixed(1)),
      energyKwh: parseFloat((Math.min(power, 22) * 0.85).toFixed(2)),
    }
  })

  const totalKwh = daily.reduce((s, d) => s + d.energyKwh, 0)
  const totalSessions = daily.reduce((s, d) => s + d.sessions, 0)
  const peakPower = Math.max(...daily.map((d) => d.peakPowerKw))
  const busiestDay = [...daily].sort((a, b) => b.energyKwh - a.energyKwh)[0]
  const busiestHour = [...hourly].sort((a, b) => b.powerKw - a.powerKw)[0]

  return {
    daily,
    hourly,
    summary: {
      last7DaysKwh: parseFloat(totalKwh.toFixed(1)),
      last7DaysSessions: totalSessions,
      last7DaysAvgDaily: parseFloat((totalKwh / 7).toFixed(1)),
      last7DaysAvgSession: parseFloat(
        (totalKwh / Math.max(totalSessions, 1)).toFixed(1),
      ),
      last7DaysPeakPower: peakPower,
      changePercent: 12.4,
      changeDirection: "up",
      bussiestDay: busiestDay.label,
      bussiestHour: `${busiestHour.hour.toString().padStart(2, "0")}:00`,
    },
  }
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
  const [analytics] = useState(() => generateMockAnalytics())

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

      {/* Tabs */}
      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">
            <RiBarChartBoxLine className="mr-1.5 size-3.5" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <RiHistoryLine className="mr-1.5 size-3.5" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="settings">
            <RiSettings3Line className="mr-1.5 size-3.5" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="info">
            <RiInformationLine className="mr-1.5 size-3.5" />
            Device Info
          </TabsTrigger>
          <TabsTrigger value="log">
            <RiHistoryLine className="mr-1.5 size-3.5" />
            OCPP Log
          </TabsTrigger>
        </TabsList>

        {/* Analytics */}
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab analytics={analytics} charger={charger} />
        </TabsContent>

        {/* Sessions */}
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

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
          <SettingsTab charger={charger} />
        </TabsContent>

        {/* Device Info */}
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

        {/* OCPP Log */}
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

function AnalyticsTab({
  analytics,
  charger,
}: {
  analytics: ReturnType<typeof generateMockAnalytics>
  charger: Charger
}) {
  const { daily, hourly, summary } = analytics
  const maxDailyKwh = Math.max(...daily.map((d) => d.energyKwh), 0.1)
  const maxHourlyPower = Math.max(...hourly.map((h) => h.powerKw), 0.1)
  const currentHour = new Date().getHours()

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              7-Day Total
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {summary.last7DaysKwh}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kWh
              </span>
            </p>
            <div className="mt-1 flex items-center gap-1">
              {summary.changeDirection === "up" ? (
                <RiArrowUpSLine className="size-4 text-emerald-500" />
              ) : (
                <RiArrowDownSLine className="size-4 text-red-500" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  summary.changeDirection === "up"
                    ? "text-emerald-600"
                    : "text-red-600",
                )}
              >
                {summary.changePercent}% vs prev week
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Sessions
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {summary.last7DaysSessions}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              avg {summary.last7DaysAvgSession} kWh/session
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Daily Average
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {summary.last7DaysAvgDaily}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kWh
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Busiest: {summary.bussiestDay}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Peak Power
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {summary.last7DaysPeakPower}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kW
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              of {charger.maxPowerKw} kW capacity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Energy Chart (7 days) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Energy Delivered — Last 7 Days</h3>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500" />
                Connector 1
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-cyan-400" />
                Connector 2
              </span>
            </div>
          </div>
          <div className="mt-4 flex h-48 items-end gap-2">
            {daily.map((day) => {
              const totalH =
                maxDailyKwh > 0
                  ? (day.energyKwh / maxDailyKwh) * 100
                  : 0
              const c1Pct =
                day.energyKwh > 0
                  ? (day.connector1Kwh / day.energyKwh) * 100
                  : 0

              return (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                >
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-20 left-1/2 z-10 hidden -translate-x-1/2 rounded-lg border bg-card px-3 py-2 text-[11px] shadow-lg group-hover:block">
                    <p className="font-semibold">{day.label}</p>
                    <p className="tabular-nums">
                      {day.energyKwh} kWh &middot; {day.sessions} sessions
                    </p>
                    <p className="text-muted-foreground tabular-nums">
                      Peak: {day.peakPowerKw} kW
                    </p>
                  </div>
                  {/* Stacked bar */}
                  <div
                    className="flex w-full flex-col overflow-hidden rounded-t-md"
                    style={{ height: `${Math.max(totalH, 2)}%` }}
                  >
                    <div
                      className="w-full bg-blue-500 transition-all duration-500"
                      style={{ height: `${c1Pct}%` }}
                    />
                    <div
                      className="w-full flex-1 bg-cyan-400 transition-all duration-500"
                    />
                  </div>
                  {/* Label */}
                  <span className="mt-2 text-[10px] text-muted-foreground">
                    {day.label}
                  </span>
                  <span className="text-[10px] font-medium tabular-nums">
                    {day.energyKwh}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hourly Power Profile (Today) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Power Profile — Today</h3>
            <span className="text-xs text-muted-foreground">
              Average kW per hour
            </span>
          </div>
          <div className="mt-4 flex h-36 items-end gap-px">
            {hourly.map((h) => {
              const barH =
                maxHourlyPower > 0
                  ? (h.powerKw / maxHourlyPower) * 100
                  : 0
              const isCurrent = h.hour === currentHour
              const isFuture = h.hour > currentHour

              return (
                <div
                  key={h.hour}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                >
                  <div className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 text-[10px] text-background shadow-lg group-hover:block">
                    <div className="font-medium">
                      {h.hour.toString().padStart(2, "0")}:00
                    </div>
                    <div>{h.powerKw} kW</div>
                    <div>{h.energyKwh} kWh</div>
                  </div>
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all duration-300",
                      isFuture
                        ? "bg-blue-100"
                        : isCurrent
                          ? "bg-blue-600"
                          : "bg-blue-400",
                    )}
                    style={{ height: `${Math.max(barH, 1)}%` }}
                  />
                  {h.hour % 4 === 0 && (
                    <span className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
                      {h.hour.toString().padStart(2, "0")}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Per-connector breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((connId) => {
          const connDailyKwh = daily.map((d) =>
            connId === 1 ? d.connector1Kwh : d.connector2Kwh,
          )
          const total = connDailyKwh.reduce((s, v) => s + v, 0)
          const max = Math.max(...connDailyKwh, 0.1)

          return (
            <Card key={connId}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RiPlugLine className="size-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">
                      Connector {connId}
                    </h3>
                  </div>
                  <span className="text-sm font-bold tabular-nums">
                    {total.toFixed(1)} kWh
                  </span>
                </div>
                <div className="mt-3 flex h-16 items-end gap-1.5">
                  {connDailyKwh.map((kwh, i) => {
                    const h = max > 0 ? (kwh / max) * 100 : 0
                    return (
                      <div
                        key={i}
                        className="group relative flex flex-1 flex-col items-center justify-end"
                      >
                        <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                          {kwh.toFixed(1)}
                        </div>
                        <div
                          className={cn(
                            "w-full rounded-t-sm",
                            connId === 1 ? "bg-blue-400" : "bg-cyan-400",
                          )}
                          style={{ height: `${Math.max(h, 3)}%` }}
                        />
                        <span className="mt-1 text-[9px] text-muted-foreground">
                          {daily[i].label.slice(0, 3)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// Mock OCPP configuration keys
const MOCK_CONFIG_KEYS = [
  { key: "HeartbeatInterval", value: "60", readonly: false },
  { key: "MeterValueSampleInterval", value: "30", readonly: false },
  { key: "ClockAlignedDataInterval", value: "0", readonly: false },
  { key: "ConnectionTimeOut", value: "120", readonly: false },
  { key: "MeterValuesAlignedData", value: "Energy.Active.Import.Register", readonly: false },
  { key: "MeterValuesSampledData", value: "Energy.Active.Import.Register,Power.Active.Import", readonly: false },
  { key: "NumberOfConnectors", value: "2", readonly: true },
  { key: "ChargePointModel", value: "Terra AC W22-T-RD-M-0", readonly: true },
  { key: "ChargePointVendor", value: "ABB", readonly: true },
  { key: "SupportedFeatureProfiles", value: "Core,FirmwareManagement,LocalAuthListManagement,SmartCharging", readonly: true },
  { key: "AuthorizeRemoteTxRequests", value: "true", readonly: false },
  { key: "LocalAuthListEnabled", value: "true", readonly: false },
  { key: "LocalPreAuthorize", value: "false", readonly: false },
  { key: "StopTransactionOnEVSideDisconnect", value: "true", readonly: false },
  { key: "UnlockConnectorOnEVSideDisconnect", value: "true", readonly: false },
]

const MOCK_AUTH_LIST = [
  { idTag: "TESLA-M3", status: "Accepted", expiryDate: "2026-12-31" },
  { idTag: "BYD-ATTO3", status: "Accepted", expiryDate: "2026-12-31" },
  { idTag: "MG-ZS-EV", status: "Accepted", expiryDate: "2026-06-30" },
  { idTag: "NISSAN-LEAF", status: "Accepted", expiryDate: "2026-12-31" },
]

function SettingsTab({ charger }: { charger: Charger }) {
  const navigate = useNavigate()
  const siteId = useSiteId()
  const [configKeys, setConfigKeys] = useState(
    MOCK_CONFIG_KEYS.map((k) => ({ ...k, editing: false, editValue: k.value })),
  )
  const [authList] = useState(MOCK_AUTH_LIST)
  const [newIdTag, setNewIdTag] = useState("")
  const [firmwareUrl, setFirmwareUrl] = useState("")
  const [displayName, setDisplayName] = useState(charger.chargePointId)
  const [maxPower, setMaxPower] = useState(String(charger.maxPowerKw))

  function handleEditConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) =>
        k.key === key ? { ...k, editing: true, editValue: k.value } : k,
      ),
    )
  }

  function handleSaveConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) =>
        k.key === key ? { ...k, editing: false, value: k.editValue } : k,
      ),
    )
    toast.success(`Configuration "${key}" updated`)
  }

  function handleCancelConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) => (k.key === key ? { ...k, editing: false } : k)),
    )
  }

  function handleAddIdTag() {
    if (!newIdTag.trim()) return
    toast.success(`ID tag "${newIdTag}" added to local auth list`)
    setNewIdTag("")
  }

  function handleFirmwareUpdate() {
    if (!firmwareUrl.trim()) return
    toast.success("Firmware update requested")
    setFirmwareUrl("")
  }

  function handleRequestDiagnostics() {
    toast.success("Diagnostics upload requested")
  }

  function handleSaveGeneral() {
    toast.success("Charger settings saved")
  }

  function handleDeleteCharger() {
    if (confirm("Are you sure you want to delete this charger? This action cannot be undone.")) {
      toast.success("Charger deleted")
      navigate(`/chargers?site=${siteId}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">General</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Basic charger configuration
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="displayName" className="text-xs">
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxPower" className="text-xs">
                Max Power (kW)
              </Label>
              <Input
                id="maxPower"
                type="number"
                value={maxPower}
                onChange={(e) => setMaxPower(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={handleSaveGeneral}>
              <RiSaveLine className="mr-1.5 size-3.5" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OCPP Configuration */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">OCPP Configuration</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read and modify charge point configuration keys
          </p>
          <div className="mt-4">
            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Key</span>
                <span>Value</span>
                <span className="w-16" />
              </div>
              <div className="divide-y">
                {configKeys.map((config) => (
                  <div
                    key={config.key}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-2"
                  >
                    <div>
                      <span className="text-xs font-medium">{config.key}</span>
                      {config.readonly && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          (read-only)
                        </span>
                      )}
                    </div>
                    <div>
                      {config.editing ? (
                        <Input
                          className="h-7 text-xs"
                          value={config.editValue}
                          onChange={(e) =>
                            setConfigKeys((prev) =>
                              prev.map((k) =>
                                k.key === config.key
                                  ? { ...k, editValue: e.target.value }
                                  : k,
                              ),
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveConfig(config.key)
                            if (e.key === "Escape")
                              handleCancelConfig(config.key)
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="truncate text-xs tabular-nums text-muted-foreground">
                          {config.value}
                        </span>
                      )}
                    </div>
                    <div className="flex w-16 justify-end">
                      {config.editing ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleSaveConfig(config.key)}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleCancelConfig(config.key)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : !config.readonly ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleEditConfig(config.key)}
                        >
                          <RiEditLine className="size-3" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charging Profiles */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">Charging Profiles</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Set power limits and time-based charging schedules
          </p>
          <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
            <RiFlashlightLine className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No charging profiles configured
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              <RiAddLine className="mr-1.5 size-3.5" />
              Create Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Authorization */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">Authorization</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Local authorization list management
          </p>
          <div className="mt-4 rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>ID Tag</span>
              <span>Status</span>
              <span>Expiry</span>
            </div>
            <div className="divide-y">
              {authList.map((auth) => (
                <div
                  key={auth.idTag}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <RiShieldKeyholeLine className="size-3.5 text-muted-foreground" />
                    {auth.idTag}
                  </span>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      auth.status === "Accepted"
                        ? "bg-emerald-500/15 text-emerald-700"
                        : "bg-red-500/15 text-red-700",
                    )}
                  >
                    {auth.status}
                  </Badge>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {auth.expiryDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="Add ID tag..."
              value={newIdTag}
              onChange={(e) => setNewIdTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddIdTag()
              }}
            />
            <Button size="sm" className="h-8" onClick={handleAddIdTag}>
              <RiAddLine className="mr-1 size-3.5" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Firmware */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold">Firmware &amp; Diagnostics</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Update firmware and request diagnostic uploads
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <RiUploadLine className="size-4 text-muted-foreground" />
                <p className="text-xs font-medium">Firmware Update</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Current:</span>
                <span className="font-medium text-foreground">
                  {charger.firmwareVersion}
                </span>
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700">
                  {charger.firmwareStatus}
                </Badge>
              </div>
              <Input
                className="h-8 text-xs"
                placeholder="Firmware download URL..."
                value={firmwareUrl}
                onChange={(e) => setFirmwareUrl(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleFirmwareUpdate}
              >
                <RiUploadLine className="mr-1.5 size-3.5" />
                Update Firmware
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <RiSettings3Line className="size-4 text-muted-foreground" />
                <p className="text-xs font-medium">Diagnostics</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Status:</span>
                <span className="font-medium text-foreground">
                  {charger.diagnosticsStatus}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleRequestDiagnostics}
              >
                Request Diagnostics Upload
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Irreversible actions
          </p>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50/30 p-4">
            <div>
              <p className="text-sm font-medium">Delete this charger</p>
              <p className="text-xs text-muted-foreground">
                Remove this charger and all its data permanently.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={handleDeleteCharger}
            >
              <RiDeleteBinLine className="mr-1.5 size-3.5" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
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
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-red-200 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => {
                    toast.success(
                      `Remote stop sent to connector ${connector.id}`,
                    )
                  }}
                >
                  <RiShutDownLine className="mr-1 size-3" />
                  Stop Charging
                </Button>
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

          {/* Available — Start Charging */}
          {connector.status === "Available" && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RiCheckboxCircleLine className="size-4 text-emerald-500" />
                Ready to charge
              </div>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  toast.success(
                    `Remote start sent to connector ${connector.id}`,
                  )
                }}
              >
                <RiFlashlightLine className="mr-1 size-3" />
                Start Charging
              </Button>
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
