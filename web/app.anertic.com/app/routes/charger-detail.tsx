import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
  RiChargingPile2Line,
  RiUserLine,
  RiSpeedLine,
  RiRemoteControlLine,
  RiCalendarCheckLine,
  RiCalendarCloseLine,
  RiLoader4Line,
} from '@remixicon/react'
import { toast } from 'sonner'

import { useSiteId } from '~/layouts/site'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { cn } from '~/lib/utils'
import { CommandsTab } from '~/components/commands-tab'

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
  avgPowerKw: number
  vehicleId?: string
  idTag?: string
  status: string
  meterStart: number
  meterStop: number | null
  stopReason?: string
  transactionId: number
}

interface OcppEvent {
  id: string
  action: string
  direction: 'in' | 'out'
  timestamp: string
  payload?: string
}

interface Reservation {
  reservationId: number
  connectorId: number
  idTag: string
  parentIdTag: string | null
  expiryDate: string
  status: string
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
  changeDirection: 'up' | 'down' | 'stable'
  bussiestDay: string
  bussiestHour: string
}

// --- Mock Data ---

function generateMockCharger(id: string): Charger {
  return {
    id,
    siteId: 'site-1',
    chargePointId: 'CP-001',
    ocppVersion: '1.6',
    status: 'Charging',
    registrationStatus: 'Accepted',
    connectorCount: 2,
    maxPowerKw: 22,
    vendor: 'ABB',
    model: 'Terra AC W22-T-RD-M-0',
    serialNumber: 'ABB-2024-001',
    firmwareVersion: '3.8.1',
    chargeBoxSerialNumber: 'CB-ABB-2024-001',
    firmwareStatus: 'Installed',
    diagnosticsStatus: 'Idle',
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
        status: 'Charging',
        powerKw: 11.2,
        maxPowerKw: 22,
        connectorType: 'Type 2',
        errorCode: 'NoError',
        vehicleId: 'Tesla Model 3',
        sessionStartedAt: new Date(Date.now() - 3600000).toISOString(),
        sessionKwh: 9.8,
        lastStatusAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 2,
        status: 'Available',
        powerKw: 0,
        maxPowerKw: 22,
        connectorType: 'Type 2',
        errorCode: 'NoError',
        sessionKwh: 0,
        lastStatusAt: new Date(Date.now() - 600000).toISOString(),
      },
    ],
  }
}

function generateMockSessions(): Session[] {
  const now = Date.now()
  return [
    {
      id: 'ses-1',
      connectorId: 1,
      startedAt: new Date(now - 3600000).toISOString(),
      endedAt: null,
      energyKwh: 9.8,
      maxPowerKw: 11.2,
      avgPowerKw: 9.8,
      vehicleId: 'Tesla Model 3',
      idTag: 'TESLA-M3',
      status: 'Active',
      meterStart: 124500,
      meterStop: null,
      transactionId: 317,
    },
    {
      id: 'ses-2',
      connectorId: 2,
      startedAt: new Date(now - 1800000).toISOString(),
      endedAt: null,
      energyKwh: 4.5,
      maxPowerKw: 7.2,
      avgPowerKw: 6.1,
      vehicleId: 'BYD Atto 3',
      idTag: 'BYD-ATTO3',
      status: 'Active',
      meterStart: 88200,
      meterStop: null,
      transactionId: 318,
    },
    {
      id: 'ses-3',
      connectorId: 1,
      startedAt: new Date(now - 14400000).toISOString(),
      endedAt: new Date(now - 10800000).toISOString(),
      energyKwh: 18.6,
      maxPowerKw: 22.0,
      avgPowerKw: 18.6,
      vehicleId: 'Hyundai Ioniq 5',
      idTag: 'USER-001',
      status: 'Completed',
      meterStart: 105900,
      meterStop: 124500,
      stopReason: 'EVDisconnected',
      transactionId: 316,
    },
    {
      id: 'ses-4',
      connectorId: 2,
      startedAt: new Date(now - 21600000).toISOString(),
      endedAt: new Date(now - 18000000).toISOString(),
      energyKwh: 12.3,
      maxPowerKw: 11.0,
      avgPowerKw: 10.2,
      idTag: 'ADMIN-001',
      status: 'Completed',
      meterStart: 75900,
      meterStop: 88200,
      stopReason: 'Local',
      transactionId: 315,
    },
    {
      id: 'ses-5',
      connectorId: 1,
      startedAt: new Date(now - 86400000).toISOString(),
      endedAt: new Date(now - 82800000).toISOString(),
      energyKwh: 7.1,
      maxPowerKw: 7.4,
      avgPowerKw: 7.1,
      vehicleId: 'Nissan Leaf',
      idTag: 'USER-002',
      status: 'Completed',
      meterStart: 98800,
      meterStop: 105900,
      stopReason: 'EVDisconnected',
      transactionId: 314,
    },
    {
      id: 'ses-6',
      connectorId: 2,
      startedAt: new Date(now - 90000000).toISOString(),
      endedAt: new Date(now - 86400000).toISOString(),
      energyKwh: 22.0,
      maxPowerKw: 22.0,
      avgPowerKw: 19.8,
      vehicleId: 'MG ZS EV',
      idTag: 'GUEST',
      status: 'Completed',
      meterStart: 53900,
      meterStop: 75900,
      stopReason: 'Remote',
      transactionId: 313,
    },
  ]
}

function generateMockEvents(): OcppEvent[] {
  const now = Date.now()
  return [
    {
      id: 'ev-1',
      action: 'Heartbeat',
      direction: 'in',
      timestamp: new Date(now - 15000).toISOString(),
    },
    {
      id: 'ev-2',
      action: 'MeterValues',
      direction: 'in',
      timestamp: new Date(now - 30000).toISOString(),
      payload: 'connectorId=1, power=11.2kW',
    },
    {
      id: 'ev-3',
      action: 'MeterValues',
      direction: 'in',
      timestamp: new Date(now - 30000).toISOString(),
      payload: 'connectorId=2, power=7.2kW',
    },
    {
      id: 'ev-4',
      action: 'StatusNotification',
      direction: 'in',
      timestamp: new Date(now - 1800000).toISOString(),
      payload: 'connector=2, status=Charging',
    },
    {
      id: 'ev-5',
      action: 'StartTransaction',
      direction: 'in',
      timestamp: new Date(now - 1800000).toISOString(),
      payload: 'connectorId=2, idTag=BYD-ATTO3',
    },
    {
      id: 'ev-6',
      action: 'StatusNotification',
      direction: 'in',
      timestamp: new Date(now - 3600000).toISOString(),
      payload: 'connector=1, status=Charging',
    },
    {
      id: 'ev-7',
      action: 'StartTransaction',
      direction: 'in',
      timestamp: new Date(now - 3600000).toISOString(),
      payload: 'connectorId=1, idTag=TESLA-M3',
    },
    {
      id: 'ev-8',
      action: 'StopTransaction',
      direction: 'in',
      timestamp: new Date(now - 10800000).toISOString(),
      payload: 'transactionId=312, meterStop=18600',
    },
    {
      id: 'ev-9',
      action: 'Heartbeat',
      direction: 'in',
      timestamp: new Date(now - 60000).toISOString(),
    },
    {
      id: 'ev-10',
      action: 'RemoteStartTransaction',
      direction: 'out',
      timestamp: new Date(now - 3700000).toISOString(),
      payload: 'connectorId=1, idTag=TESLA-M3',
    },
  ]
}

function generateMockAnalytics(): {
  daily: DailyEnergy[]
  hourly: HourlyPower[]
  summary: AnalyticsSummary
} {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
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
      date: d.toISOString().split('T')[0],
      label: i === 6 ? 'Today' : days[d.getDay()],
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
        (totalKwh / Math.max(totalSessions, 1)).toFixed(1)
      ),
      last7DaysPeakPower: peakPower,
      changePercent: 12.4,
      changeDirection: 'up',
      bussiestDay: busiestDay.label,
      bussiestHour: `${busiestHour.hour.toString().padStart(2, '0')}:00`,
    },
  }
}

function generateMockReservations(): Reservation[] {
  const now = Date.now()
  return [
    {
      reservationId: 101,
      connectorId: 2,
      idTag: 'USER-001',
      parentIdTag: null,
      expiryDate: new Date(now + 25 * 60000).toISOString(),
      status: 'Active',
    },
    {
      reservationId: 100,
      connectorId: 1,
      idTag: 'TESLA-M3',
      parentIdTag: 'FLEET-A',
      expiryDate: new Date(now - 3600000).toISOString(),
      status: 'Expired',
    },
    {
      reservationId: 99,
      connectorId: 2,
      idTag: 'ADMIN-001',
      parentIdTag: null,
      expiryDate: new Date(now - 7200000).toISOString(),
      status: 'Used',
    },
    {
      reservationId: 98,
      connectorId: 1,
      idTag: 'GUEST',
      parentIdTag: null,
      expiryDate: new Date(now - 14400000).toISOString(),
      status: 'Cancelled',
    },
    {
      reservationId: 97,
      connectorId: 2,
      idTag: 'USER-002',
      parentIdTag: null,
      expiryDate: new Date(now - 86400000).toISOString(),
      status: 'Expired',
    },
  ]
}

// --- Helpers ---

function statusColor(status: string) {
  switch (status) {
    case 'Available':
      return 'bg-emerald-500/15 text-emerald-700'
    case 'Charging':
    case 'Preparing':
      return 'bg-blue-500/15 text-blue-700'
    case 'SuspendedEV':
    case 'SuspendedEVSE':
    case 'Finishing':
      return 'bg-amber-500/15 text-amber-700'
    case 'Faulted':
      return 'bg-red-500/15 text-red-700'
    case 'Reserved':
      return 'bg-purple-500/15 text-purple-700'
    default:
      return 'bg-gray-500/15 text-gray-700'
  }
}

function statusDot(status: string) {
  switch (status) {
    case 'Available':
      return 'bg-emerald-500'
    case 'Charging':
    case 'Preparing':
      return 'bg-blue-500'
    case 'SuspendedEV':
    case 'SuspendedEVSE':
    case 'Finishing':
      return 'bg-amber-500'
    case 'Faulted':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}

function registrationColor(status: string) {
  switch (status) {
    case 'Accepted':
      return 'bg-emerald-500/15 text-emerald-700'
    case 'Pending':
      return 'bg-amber-500/15 text-amber-700'
    case 'Rejected':
      return 'bg-red-500/15 text-red-700'
    default:
      return 'bg-gray-500/15 text-gray-700'
  }
}

function reservationStatusColor(status: string) {
  switch (status) {
    case 'Active':
      return 'bg-emerald-500/15 text-emerald-700'
    case 'Used':
      return 'bg-blue-500/15 text-blue-700'
    case 'Cancelled':
      return 'bg-red-500/15 text-red-700'
    case 'Expired':
    default:
      return 'bg-gray-500/15 text-gray-600'
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// --- Main Component ---

export default function ChargerDetail() {
  const { chargerId } = useParams()
  const siteId = useSiteId()
  const [mounted, setMounted] = useState(false)

  // TODO: Replace with API calls when backend is ready
  // const { data: charger, isLoading } = useSWR(
  //   chargerId ? ["charger.get", chargerId] : null,
  //   () => api<Charger>("charger.get", { id: chargerId }),
  // )
  const [charger] = useState<Charger>(() =>
    generateMockCharger(chargerId || '')
  )
  const [sessions] = useState<Session[]>(() => generateMockSessions())
  const [events] = useState<OcppEvent[]>(() => generateMockEvents())
  const [analytics] = useState(() => generateMockAnalytics())
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isCharging =
    charger.status === 'Charging' || charger.status === 'Preparing'
  const isFaulted = charger.status === 'Faulted'
  const isOnline = !!charger.lastHeartbeatAt

  const activeSessions = sessions.filter((s) => s.status === 'Active')
  const completedSessions = sessions.filter((s) => s.status === 'Completed')

  return (
    <div
      className={cn(
        'flex flex-col gap-5 transition-opacity duration-500',
        mounted ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
              <Link to={`/chargers${siteId ? `?site=${siteId}` : ''}`}>
                <RiArrowLeftLine aria-hidden="true" data-icon="inline-start" />
                Chargers
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                {isCharging && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75 motion-reduce:animate-none" />
                )}
                {isFaulted && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
                )}
                <span
                  className={cn(
                    'relative inline-flex size-3 rounded-full',
                    statusDot(charger.status)
                  )}
                />
              </span>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {charger.chargePointId}
              </h1>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge className={cn('text-[10px]', statusColor(charger.status))}>
                {charger.status}
              </Badge>
              <Badge
                className={cn(
                  'text-[10px]',
                  registrationColor(charger.registrationStatus)
                )}
              >
                {charger.registrationStatus}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {isOnline ? (
                  <RiSignalWifiLine
                    aria-hidden="true"
                    className="size-3 text-emerald-500"
                  />
                ) : (
                  <RiSignalWifiOffLine
                    aria-hidden="true"
                    className="size-3 text-red-400"
                  />
                )}
                {timeAgo(charger.lastHeartbeatAt)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {charger.vendor} {charger.model}
            </p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button variant="outline" size="sm">
              <RiRestartLine aria-hidden="true" data-icon="inline-start" />
              Reset
            </Button>
            <Button variant="outline" size="sm">
              <RiShutDownLine aria-hidden="true" data-icon="inline-start" />
              Reboot
            </Button>
          </div>
        </div>
        {/* Mobile action buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button variant="outline" size="sm" className="flex-1">
            <RiRestartLine aria-hidden="true" data-icon="inline-start" />
            Reset
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <RiShutDownLine aria-hidden="true" data-icon="inline-start" />
            Reboot
          </Button>
        </div>
      </div>

      {/* Connectors */}
      <div className="flex flex-col gap-3">
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
        <div>
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="analytics">
              <RiBarChartBoxLine
                aria-hidden="true"
                className="size-3.5 sm:mr-1.5"
              />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <RiHistoryLine
                aria-hidden="true"
                className="size-3.5 sm:mr-1.5"
              />
              <span className="hidden sm:inline">Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="reservations">
              <RiCalendarCheckLine
                aria-hidden="true"
                className="size-3.5 sm:mr-1.5"
              />
              <span className="hidden sm:inline">Reservations</span>
            </TabsTrigger>
            <TabsTrigger value="info">
              <RiInformationLine
                aria-hidden="true"
                className="size-3.5 sm:mr-1.5"
              />
              <span className="hidden sm:inline">Device Info</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <RiSettings3Line
                aria-hidden="true"
                className="size-3.5 sm:mr-1.5"
              />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="commands">
              <RiRemoteControlLine
                aria-hidden="true"
                className="size-3.5 sm:mr-1.5"
              />
              <span className="hidden sm:inline">Commands</span>
            </TabsTrigger>
            <TabsTrigger value="log">
              <RiHistoryLine
                aria-hidden="true"
                className="size-3.5 sm:mr-1.5"
              />
              <span className="hidden sm:inline">OCPP Logs</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Analytics */}
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab analytics={analytics} charger={charger} />
        </TabsContent>

        {/* Sessions */}
        <TabsContent value="sessions" className="mt-4">
          <div className="flex flex-col gap-4">
            {activeSessions.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Active
                </p>
                {activeSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    selected={selectedSession?.id === session.id}
                    onClick={() =>
                      setSelectedSession(
                        selectedSession?.id === session.id ? null : session
                      )
                    }
                  />
                ))}
              </div>
            )}
            {completedSessions.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Recent
                </p>
                {completedSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    selected={selectedSession?.id === session.id}
                    onClick={() =>
                      setSelectedSession(
                        selectedSession?.id === session.id ? null : session
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Reservations */}
        <TabsContent value="reservations" className="mt-4">
          <ReservationsTab
            chargerId={charger.id}
            connectors={charger.connectors}
          />
        </TabsContent>

        {/* Device Info */}
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow
                  label="Charge Point ID"
                  value={charger.chargePointId}
                />
                <InfoRow label="OCPP Version" value={charger.ocppVersion} />
                <InfoRow label="Vendor" value={charger.vendor || '—'} />
                <InfoRow label="Model" value={charger.model || '—'} />
                <InfoRow
                  label="Serial Number"
                  value={charger.serialNumber || '—'}
                />
                <InfoRow
                  label="Charge Box Serial"
                  value={charger.chargeBoxSerialNumber || '—'}
                />
                <InfoRow
                  label="Firmware"
                  value={charger.firmwareVersion || '—'}
                />
                <InfoRow
                  label="Firmware Status"
                  value={charger.firmwareStatus}
                />
                <InfoRow
                  label="Diagnostics Status"
                  value={charger.diagnosticsStatus}
                />
                <InfoRow
                  label="Connector Count"
                  value={String(charger.connectorCount)}
                />
                <InfoRow label="Max Power" value={`${charger.maxPowerKw} kW`} />
                <InfoRow
                  label="Heartbeat Interval"
                  value={`${charger.heartbeatInterval}s`}
                />
                <InfoRow
                  label="Registered"
                  value={new Date(charger.createdAt).toLocaleDateString([], {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
          <SettingsTab charger={charger} />
        </TabsContent>

        {/* Commands */}
        <TabsContent value="commands" className="mt-4">
          <CommandsTab
            chargerId={charger.id}
            connectors={charger.connectors.map((c) => ({
              id: c.id,
              status: c.status,
            }))}
            ocppVersion={charger.ocppVersion}
          />
        </TabsContent>

        {/* OCPP Logs */}
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
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                        event.direction === 'in'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-amber-500/10 text-amber-600'
                      )}
                    >
                      {event.direction === 'in' ? 'IN' : 'OUT'}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {event.action}
                    </span>
                    {event.payload && (
                      <span className="hidden truncate text-xs text-muted-foreground lg:block lg:max-w-[300px]">
                        {event.payload}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
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
    <div className="flex flex-col gap-5">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              7-Day Total
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {summary.last7DaysKwh}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kWh
              </span>
            </p>
            <div className="mt-1 flex items-center gap-1">
              {summary.changeDirection === 'up' ? (
                <RiArrowUpSLine
                  aria-hidden="true"
                  className="size-4 text-emerald-500"
                />
              ) : (
                <RiArrowDownSLine
                  aria-hidden="true"
                  className="size-4 text-red-500"
                />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  summary.changeDirection === 'up'
                    ? 'text-emerald-600'
                    : 'text-red-600'
                )}
              >
                {summary.changePercent}% vs prev week
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
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
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
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
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
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
            <h3 className="text-sm font-medium">
              Energy Delivered — Last 7 Days
            </h3>
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
                maxDailyKwh > 0 ? (day.energyKwh / maxDailyKwh) * 100 : 0
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
                      className="w-full bg-blue-500 transition-[height] duration-500"
                      style={{ height: `${c1Pct}%` }}
                    />
                    <div className="w-full flex-1 bg-cyan-400 transition-[height] duration-500" />
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
                maxHourlyPower > 0 ? (h.powerKw / maxHourlyPower) * 100 : 0
              const isCurrent = h.hour === currentHour
              const isFuture = h.hour > currentHour

              return (
                <div
                  key={h.hour}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                >
                  <div className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 text-[10px] text-background shadow-lg group-hover:block">
                    <div className="font-medium">
                      {h.hour.toString().padStart(2, '0')}:00
                    </div>
                    <div>{h.powerKw} kW</div>
                    <div>{h.energyKwh} kWh</div>
                  </div>
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-[height] duration-300',
                      isFuture
                        ? 'bg-blue-100'
                        : isCurrent
                          ? 'bg-blue-600'
                          : 'bg-blue-400'
                    )}
                    style={{ height: `${Math.max(barH, 1)}%` }}
                  />
                  {h.hour % 4 === 0 && (
                    <span className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                      {h.hour.toString().padStart(2, '0')}
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
            connId === 1 ? d.connector1Kwh : d.connector2Kwh
          )
          const total = connDailyKwh.reduce((s, v) => s + v, 0)
          const max = Math.max(...connDailyKwh, 0.1)

          return (
            <Card key={connId}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RiPlugLine
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    <h3 className="text-sm font-medium">Connector {connId}</h3>
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
                            'w-full rounded-t-sm',
                            connId === 1 ? 'bg-blue-400' : 'bg-cyan-400'
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
  { key: 'HeartbeatInterval', value: '60', readonly: false },
  { key: 'MeterValueSampleInterval', value: '30', readonly: false },
  { key: 'ClockAlignedDataInterval', value: '0', readonly: false },
  { key: 'ConnectionTimeOut', value: '120', readonly: false },
  {
    key: 'MeterValuesAlignedData',
    value: 'Energy.Active.Import.Register',
    readonly: false,
  },
  {
    key: 'MeterValuesSampledData',
    value: 'Energy.Active.Import.Register,Power.Active.Import',
    readonly: false,
  },
  { key: 'NumberOfConnectors', value: '2', readonly: true },
  { key: 'ChargePointModel', value: 'Terra AC W22-T-RD-M-0', readonly: true },
  { key: 'ChargePointVendor', value: 'ABB', readonly: true },
  {
    key: 'SupportedFeatureProfiles',
    value: 'Core,FirmwareManagement,LocalAuthListManagement,SmartCharging',
    readonly: true,
  },
  { key: 'AuthorizeRemoteTxRequests', value: 'true', readonly: false },
  { key: 'LocalAuthListEnabled', value: 'true', readonly: false },
  { key: 'LocalPreAuthorize', value: 'false', readonly: false },
  { key: 'StopTransactionOnEVSideDisconnect', value: 'true', readonly: false },
  { key: 'UnlockConnectorOnEVSideDisconnect', value: 'true', readonly: false },
]

const MOCK_AUTH_LIST = [
  { idTag: 'TESLA-M3', status: 'Accepted', expiryDate: '2026-12-31' },
  { idTag: 'BYD-ATTO3', status: 'Accepted', expiryDate: '2026-12-31' },
  { idTag: 'MG-ZS-EV', status: 'Accepted', expiryDate: '2026-06-30' },
  { idTag: 'NISSAN-LEAF', status: 'Accepted', expiryDate: '2026-12-31' },
]

function SettingsTab({ charger }: { charger: Charger }) {
  const navigate = useNavigate()
  const siteId = useSiteId()
  const [configKeys, setConfigKeys] = useState(
    MOCK_CONFIG_KEYS.map((k) => ({ ...k, editing: false, editValue: k.value }))
  )
  const [authList] = useState(MOCK_AUTH_LIST)
  const [newIdTag, setNewIdTag] = useState('')
  const [firmwareUrl, setFirmwareUrl] = useState('')
  const [displayName, setDisplayName] = useState(charger.chargePointId)
  const [maxPower, setMaxPower] = useState(String(charger.maxPowerKw))

  function handleEditConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) =>
        k.key === key ? { ...k, editing: true, editValue: k.value } : k
      )
    )
  }

  function handleSaveConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) =>
        k.key === key ? { ...k, editing: false, value: k.editValue } : k
      )
    )
    toast.success(`Configuration "${key}" updated`)
  }

  function handleCancelConfig(key: string) {
    setConfigKeys((prev) =>
      prev.map((k) => (k.key === key ? { ...k, editing: false } : k))
    )
  }

  function handleAddIdTag() {
    if (!newIdTag.trim()) return
    toast.success(`ID tag "${newIdTag}" added to local auth list`)
    setNewIdTag('')
  }

  function handleFirmwareUpdate() {
    if (!firmwareUrl.trim()) return
    toast.success('Firmware update requested')
    setFirmwareUrl('')
  }

  function handleRequestDiagnostics() {
    toast.success('Diagnostics upload requested')
  }

  function handleSaveGeneral() {
    toast.success('Charger settings saved')
  }

  function handleDeleteCharger() {
    if (
      confirm(
        'Are you sure you want to delete this charger? This action cannot be undone.'
      )
    ) {
      toast.success('Charger deleted')
      navigate(`/chargers?site=${siteId}`)
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
              <RiSaveLine aria-hidden="true" data-icon="inline-start" />
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
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
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
                                  : k
                              )
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveConfig(config.key)
                            if (e.key === 'Escape')
                              handleCancelConfig(config.key)
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="truncate text-xs text-muted-foreground tabular-nums">
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
                          aria-label={`Edit ${config.key}`}
                          onClick={() => handleEditConfig(config.key)}
                        >
                          <RiEditLine aria-hidden="true" className="size-3" />
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
            <RiFlashlightLine
              aria-hidden="true"
              className="mx-auto size-8 text-muted-foreground/40"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              No charging profiles configured
            </p>
            <Button variant="outline" size="sm" className="mt-3">
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
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
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b bg-muted/50 px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
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
                    <RiShieldKeyholeLine
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                    {auth.idTag}
                  </span>
                  <Badge
                    className={cn(
                      'text-[10px]',
                      auth.status === 'Accepted'
                        ? 'bg-emerald-500/15 text-emerald-700'
                        : 'bg-red-500/15 text-red-700'
                    )}
                  >
                    {auth.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
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
                if (e.key === 'Enter') handleAddIdTag()
              }}
            />
            <Button size="sm" className="h-8" onClick={handleAddIdTag}>
              <RiAddLine aria-hidden="true" data-icon="inline-start" />
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
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <RiUploadLine
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <p className="text-xs font-medium">Firmware Update</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Current:</span>
                <span className="font-medium text-foreground">
                  {charger.firmwareVersion}
                </span>
                <Badge className="bg-emerald-500/15 text-[10px] text-emerald-700">
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
                <RiUploadLine aria-hidden="true" data-icon="inline-start" />
                Update Firmware
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <RiSettings3Line
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
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
              <RiDeleteBinLine aria-hidden="true" data-icon="inline-start" />
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
    connector.status === 'Charging' || connector.status === 'Preparing'
  const isSuspended =
    connector.status === 'SuspendedEV' || connector.status === 'SuspendedEVSE'
  const isFaulted = connector.status === 'Faulted'
  const powerPercent =
    connector.maxPowerKw > 0
      ? (connector.powerKw / connector.maxPowerKw) * 100
      : 0

  const [startOpen, setStartOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden',
          isFaulted && 'border-red-200',
          isActive && 'border-blue-200'
        )}
      >
        <CardContent className="p-0">
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <RiPlugLine
                    aria-hidden="true"
                    className="size-5 text-muted-foreground"
                  />
                  <span
                    className={cn(
                      'absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white',
                      statusDot(connector.status)
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Connector {connector.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {connector.connectorType || 'Type 2'} &middot;{' '}
                    {connector.maxPowerKw} kW max
                  </p>
                </div>
              </div>
              <Badge
                className={cn('text-[10px]', statusColor(connector.status))}
              >
                {connector.status}
              </Badge>
            </div>

            {/* Active session details */}
            {isActive && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">
                    {connector.vehicleId || 'Unknown vehicle'}
                  </p>
                  {connector.sessionStartedAt && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <RiTimeLine aria-hidden="true" className="size-3" />
                      {sessionDuration(connector.sessionStartedAt)}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Power</p>
                    <p className="text-lg font-bold text-blue-700 tabular-nums">
                      {formatPower(connector.powerKw)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Session Energy
                    </p>
                    <p className="text-lg font-bold tabular-nums">
                      {connector.sessionKwh.toFixed(1)}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        kWh
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Power utilization</span>
                    <span className="tabular-nums">
                      {powerPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-[width] duration-1000"
                      style={{ width: `${powerPercent}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-red-200 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => setStopOpen(true)}
                  >
                    <RiShutDownLine
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
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
                    {connector.vehicleId || 'Unknown vehicle'}
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
            {isFaulted && connector.errorCode !== 'NoError' && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50/30 p-3">
                <div className="flex items-center gap-2">
                  <RiAlertLine
                    aria-hidden="true"
                    className="size-4 text-red-500"
                  />
                  <p className="text-xs font-medium text-red-700">
                    {connector.errorCode}
                  </p>
                </div>
              </div>
            )}

            {/* Available — Start Charging */}
            {connector.status === 'Available' && (
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RiCheckboxCircleLine
                    aria-hidden="true"
                    className="size-4 text-emerald-500"
                  />
                  Ready to charge
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setStartOpen(true)}
                >
                  <RiFlashlightLine
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  Start Charging
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Start Charging Dialog */}
      <StartChargingDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        connectorId={connector.id}
        maxPowerKw={connector.maxPowerKw}
        connectorType={connector.connectorType}
      />

      {/* Stop Charging Dialog */}
      <StopChargingDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        connectorId={connector.id}
        vehicleId={connector.vehicleId}
        sessionKwh={connector.sessionKwh}
        sessionStartedAt={connector.sessionStartedAt}
      />
    </>
  )
}

function StartChargingDialog({
  open,
  onOpenChange,
  connectorId,
  maxPowerKw,
  connectorType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorId: number
  maxPowerKw: number
  connectorType: string
}) {
  const [step, setStep] = useState<'config' | 'sending' | 'sent'>('config')
  const [idTag, setIdTag] = useState('')
  const [powerLimit, setPowerLimit] = useState(String(maxPowerKw))
  function handleStart() {
    if (!idTag.trim()) {
      toast.error('Please enter an ID tag')
      return
    }
    setStep('sending')
    // Simulate sending command
    setTimeout(() => {
      setStep('sent')
    }, 1500)
  }

  function handleClose() {
    onOpenChange(false)
    // Reset after animation
    setTimeout(() => {
      setStep('config')
      setIdTag('')
      setPowerLimit(String(maxPowerKw))
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'config' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <RiChargingPile2Line
                    aria-hidden="true"
                    className="size-4 text-blue-600"
                  />
                </div>
                Start Charging
              </DialogTitle>
              <DialogDescription>
                Send a remote start command to connector #{connectorId}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              {/* Connector info */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                <RiPlugLine
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <div className="flex-1 text-xs">
                  <span className="font-medium">Connector {connectorId}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    &middot; {connectorType || 'Type 2'} &middot; {maxPowerKw}{' '}
                    kW
                  </span>
                </div>
                <Badge className="bg-emerald-500/15 text-[10px] text-emerald-700">
                  Available
                </Badge>
              </div>

              {/* ID Tag */}
              <div className="grid gap-2">
                <Label
                  htmlFor="idTag"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <RiUserLine aria-hidden="true" className="size-3" />
                  ID Tag / Identifier
                </Label>
                <select
                  id="idTag"
                  value={idTag}
                  onChange={(e) => setIdTag(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  autoFocus
                >
                  <option value="">Select an ID tag...</option>
                  <option value="ADMIN-001">ADMIN-001</option>
                  <option value="USER-001">USER-001</option>
                  <option value="USER-002">USER-002</option>
                  <option value="TESLA-M3">TESLA-M3</option>
                  <option value="GUEST">GUEST</option>
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Select an authorized ID tag from the local auth list
                </p>
              </div>

              {/* Power Limit */}
              <div className="grid gap-2">
                <Label
                  htmlFor="powerLimit"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <RiSpeedLine aria-hidden="true" className="size-3" />
                  Power Limit (kW)
                </Label>
                <Input
                  id="powerLimit"
                  type="number"
                  min="1"
                  max={maxPowerKw}
                  step="0.1"
                  value={powerLimit}
                  onChange={(e) => setPowerLimit(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Max: {maxPowerKw} kW. Leave as-is for full power.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleStart}>
                <RiFlashlightLine aria-hidden="true" data-icon="inline-start" />
                Start Charging
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'sending' && (
          <div className="flex flex-col items-center py-10">
            <div className="relative">
              <div className="size-16 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RiChargingPile2Line
                  aria-hidden="true"
                  className="size-6 text-blue-500"
                />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">
              Sending RemoteStartTransaction…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connector #{connectorId} &middot; ID Tag: {idTag}
            </p>
          </div>
        )}

        {step === 'sent' && (
          <div className="flex flex-col items-center py-10">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <RiCheckboxCircleLine
                aria-hidden="true"
                className="size-8 text-emerald-500"
              />
            </div>
            <p className="mt-4 text-sm font-medium">Command Sent</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              RemoteStartTransaction sent to connector #{connectorId}.
              <br />
              Waiting for the charger to accept and begin charging.
            </p>
            <div className="mt-4 w-full rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="grid gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID Tag</span>
                  <span className="font-medium">{idTag}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Power Limit</span>
                  <span className="font-medium tabular-nums">
                    {powerLimit} kW
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connector</span>
                  <span className="font-medium">#{connectorId}</span>
                </div>
              </div>
            </div>
            <Button className="mt-4" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StopChargingDialog({
  open,
  onOpenChange,
  connectorId,
  vehicleId,
  sessionKwh,
  sessionStartedAt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectorId: number
  vehicleId?: string
  sessionKwh: number
  sessionStartedAt?: string
}) {
  const [step, setStep] = useState<'confirm' | 'stopping' | 'stopped'>(
    'confirm'
  )

  function handleStop() {
    setStep('stopping')
    setTimeout(() => {
      setStep('stopped')
    }, 1500)
  }

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      setStep('confirm')
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-red-500/10">
                  <RiShutDownLine
                    aria-hidden="true"
                    className="size-4 text-red-600"
                  />
                </div>
                Stop Charging
              </DialogTitle>
              <DialogDescription>
                This will send a remote stop command to connector #{connectorId}
                .
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/30 px-3 py-3">
              <div className="grid gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connector</span>
                  <span className="font-medium">#{connectorId}</span>
                </div>
                {vehicleId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle</span>
                    <span className="font-medium">{vehicleId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Energy Delivered
                  </span>
                  <span className="font-medium tabular-nums">
                    {sessionKwh.toFixed(1)} kWh
                  </span>
                </div>
                {sessionStartedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium tabular-nums">
                      {sessionDuration(sessionStartedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleStop}>
                <RiShutDownLine aria-hidden="true" data-icon="inline-start" />
                Stop Charging
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'stopping' && (
          <div className="flex flex-col items-center py-10">
            <div className="relative">
              <div className="size-16 animate-spin rounded-full border-4 border-red-100 border-t-red-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RiShutDownLine
                  aria-hidden="true"
                  className="size-6 text-red-500"
                />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">
              Sending RemoteStopTransaction…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connector #{connectorId}
            </p>
          </div>
        )}

        {step === 'stopped' && (
          <div className="flex flex-col items-center py-10">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <RiCheckboxCircleLine
                aria-hidden="true"
                className="size-8 text-emerald-500"
              />
            </div>
            <p className="mt-4 text-sm font-medium">Charging Stopped</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              RemoteStopTransaction sent successfully.
              <br />
              The charger will finalize the session.
            </p>
            <Button className="mt-4" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SessionRow({
  session,
  selected,
  onClick,
}: {
  session: Session
  selected: boolean
  onClick: () => void
}) {
  const isActive = session.status === 'Active'

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors',
          isActive && 'border-blue-200 bg-blue-50/30',
          !isActive && 'hover:bg-muted/50',
          selected && !isActive && 'border-foreground/20 bg-muted/30',
          selected && 'rounded-b-none'
        )}
      >
        {/* Status dot */}
        <span className="relative flex size-2.5">
          {isActive && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75 motion-reduce:animate-none" />
          )}
          <span
            className={cn(
              'relative inline-flex size-2.5 rounded-full',
              isActive ? 'bg-blue-500' : 'bg-gray-300'
            )}
          />
        </span>

        {/* Connector */}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <RiPlugLine aria-hidden="true" className="size-3" />#
          {session.connectorId}
        </span>

        {/* Vehicle */}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {session.vehicleId || 'Unknown vehicle'}
        </span>

        {/* Energy */}
        <span className="text-sm font-semibold tabular-nums">
          {session.energyKwh.toFixed(1)} kWh
        </span>

        {/* Max power */}
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
          {formatPower(session.maxPowerKw)} peak
        </span>

        {/* Duration */}
        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <RiTimeLine aria-hidden="true" className="size-3" />
          {sessionDuration(session.startedAt, session.endedAt)}
        </span>

        {/* Time */}
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTime(session.startedAt)}
        </span>

        {/* Expand indicator */}
        <RiArrowDownSLine
          aria-hidden="true"
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            selected && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded detail panel */}
      {selected && <SessionDetail session={session} />}
    </div>
  )
}

function SessionDetail({ session }: { session: Session }) {
  const isActive = session.status === 'Active'

  return (
    <div
      className={cn(
        'rounded-b-lg border border-t-0 px-5 py-4',
        isActive
          ? 'border-blue-200 bg-blue-50/20'
          : 'border-foreground/20 bg-muted/20'
      )}
    >
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Transaction ID
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold">
            #{session.transactionId}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            ID Tag
          </p>
          <p className="mt-0.5 font-mono text-sm">{session.idTag || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Vehicle
          </p>
          <p className="mt-0.5 text-sm">{session.vehicleId || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Connector
          </p>
          <p className="mt-0.5 text-sm">#{session.connectorId}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Energy Delivered
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {session.energyKwh.toFixed(2)} kWh
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Duration
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {sessionDuration(session.startedAt, session.endedAt)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Peak Power
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {formatPower(session.maxPowerKw)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Avg Power
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {formatPower(session.avgPowerKw)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Status
          </p>
          <Badge
            className={cn(
              'mt-0.5 text-[10px]',
              isActive
                ? 'bg-blue-500/15 text-blue-700'
                : 'bg-emerald-500/15 text-emerald-700'
            )}
          >
            {session.status}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Started
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {new Date(session.startedAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Ended
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {session.endedAt
              ? new Date(session.endedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'In progress'}
          </p>
        </div>
        {session.stopReason && (
          <div>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Stop Reason
            </p>
            <p className="mt-0.5 text-sm">{session.stopReason}</p>
          </div>
        )}
      </div>

      {/* Meter values */}
      <div className="mt-4 flex items-center gap-4 rounded-md border bg-background/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Meter Start:</span>
          <span className="font-mono tabular-nums">
            {session.meterStart.toLocaleString()} Wh
          </span>
        </div>
        <span className="text-muted-foreground">&rarr;</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Meter Stop:</span>
          <span className="font-mono tabular-nums">
            {session.meterStop !== null
              ? `${session.meterStop.toLocaleString()} Wh`
              : '—'}
          </span>
        </div>
      </div>
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

// --- Reservations ---

function ReservationCard({
  reservation,
  onCancel,
  cancelling,
}: {
  reservation: Reservation
  onCancel: (reservationId: number) => void
  cancelling: number | null
}) {
  const isActive = reservation.status === 'Active'
  const isCancelling = cancelling === reservation.reservationId
  const expiryDate = new Date(reservation.expiryDate)
  const isExpired = expiryDate.getTime() < Date.now()

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
        isActive && !isExpired
          ? 'border-emerald-200 bg-emerald-50/30'
          : 'bg-muted/20'
      )}
    >
      {/* Connector badge */}
      <span className="flex shrink-0 items-center justify-center rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
        #{reservation.connectorId}
      </span>

      {/* Reservation ID */}
      <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
        R-{reservation.reservationId}
      </span>

      {/* ID Tag */}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {reservation.idTag}
      </span>

      {/* Parent ID Tag */}
      {reservation.parentIdTag && (
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          via {reservation.parentIdTag}
        </span>
      )}

      {/* Expiry */}
      <span
        className={cn(
          'shrink-0 text-xs tabular-nums',
          isActive && !isExpired ? 'text-emerald-700' : 'text-muted-foreground'
        )}
      >
        {isActive && !isExpired
          ? `Expires ${timeAgo(reservation.expiryDate).replace(' ago', ' left').replace('Just now', 'now')}`
          : formatDateTime(reservation.expiryDate)}
      </span>

      {/* Status badge */}
      <Badge
        className={cn(
          'shrink-0 text-[10px]',
          reservationStatusColor(reservation.status)
        )}
      >
        {reservation.status}
      </Badge>

      {/* Cancel button — active only */}
      {isActive && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 shrink-0 border-red-200 text-xs text-red-600 hover:bg-red-50"
          disabled={isCancelling}
          onClick={() => onCancel(reservation.reservationId)}
        >
          {isCancelling ? (
            <RiLoader4Line aria-hidden="true" className="size-3 animate-spin" />
          ) : (
            <>
              <RiCalendarCloseLine
                aria-hidden="true"
                data-icon="inline-start"
              />
              Cancel
            </>
          )}
        </Button>
      )}
    </div>
  )
}

function NewReservationDialog({
  open,
  onOpenChange,
  connectors,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectors: ConnectorDetail[]
  onCreated: (reservation: Reservation) => void
}) {
  const defaultExpiry = () => {
    const d = new Date(Date.now() + 30 * 60000)
    // Format for datetime-local input: "YYYY-MM-DDTHH:mm"
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [connectorId, setConnectorId] = useState<number | null>(null)
  const [idTag, setIdTag] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [expiryDate, setExpiryDate] = useState(defaultExpiry)
  const [parentIdTag, setParentIdTag] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setConnectorId(null)
    setIdTag('')
    setReservationId('')
    setExpiryDate(defaultExpiry())
    setParentIdTag('')
    setAdvancedOpen(false)
    setSubmitting(false)
  }

  function handleClose() {
    onOpenChange(false)
    setTimeout(reset, 200)
  }

  function validate(): string | null {
    if (connectorId === null) return 'Please select a connector'
    if (!idTag.trim()) return 'ID tag is required'
    if (!reservationId.trim() || isNaN(Number(reservationId))) {
      return 'A valid reservation ID is required'
    }
    if (!expiryDate) return 'Expiry date is required'
    if (new Date(expiryDate).getTime() <= Date.now()) {
      return 'Expiry date must be in the future'
    }
    return null
  }

  function handleSubmit() {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setSubmitting(true)
    // TODO: replace with api("charger.reserveNow", { id: chargerId, connectorId, expiryDate, idTag, parentIdTag, reservationId })
    setTimeout(() => {
      const newReservation: Reservation = {
        reservationId: Number(reservationId),
        connectorId: connectorId!,
        idTag: idTag.trim(),
        parentIdTag: parentIdTag.trim() || null,
        expiryDate: new Date(expiryDate).toISOString(),
        status: 'Active',
      }
      onCreated(newReservation)
      toast.success(`Connector #${connectorId} reserved for ${idTag.trim()}`)
      handleClose()
    }, 1200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <RiCalendarCheckLine
                aria-hidden="true"
                className="size-4 text-emerald-600"
              />
            </div>
            New Reservation
          </DialogTitle>
          <DialogDescription>
            Reserve a connector for a specific ID tag and time window.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Connector selector */}
          <div className="grid gap-2">
            <Label className="text-xs">Connector</Label>
            <div className="flex gap-2">
              {connectors.map((conn) => {
                const isAvailable = conn.status === 'Available'
                return (
                  <button
                    key={conn.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => setConnectorId(conn.id)}
                    className={cn(
                      'flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-xs transition-colors',
                      connectorId === conn.id
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700'
                        : isAvailable
                          ? 'hover:border-foreground/30 hover:bg-muted/50'
                          : 'cursor-not-allowed opacity-40'
                    )}
                  >
                    <RiPlugLine aria-hidden="true" className="size-4" />
                    <span className="font-semibold">#{conn.id}</span>
                    <span
                      className={cn(
                        'text-[10px]',
                        isAvailable
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {conn.status}
                    </span>
                  </button>
                )
              })}
            </div>
            {connectors.every((c) => c.status !== 'Available') && (
              <p className="text-[10px] text-amber-600">
                No connectors are currently available for reservation.
              </p>
            )}
          </div>

          {/* ID Tag */}
          <div className="grid gap-2">
            <Label
              htmlFor="res-idTag"
              className="flex items-center gap-1.5 text-xs"
            >
              <RiUserLine aria-hidden="true" className="size-3" />
              ID Tag
            </Label>
            <Input
              id="res-idTag"
              placeholder="e.g. USER-001"
              value={idTag}
              onChange={(e) => setIdTag(e.target.value)}
            />
          </div>

          {/* Reservation ID */}
          <div className="grid gap-2">
            <Label htmlFor="res-id" className="text-xs">
              Reservation ID
            </Label>
            <Input
              id="res-id"
              type="number"
              min="1"
              placeholder="e.g. 102"
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              A unique numeric ID for this reservation (OCPP field).
            </p>
          </div>

          {/* Expiry Date */}
          <div className="grid gap-2">
            <Label
              htmlFor="res-expiry"
              className="flex items-center gap-1.5 text-xs"
            >
              <RiTimeLine aria-hidden="true" className="size-3" />
              Expiry Date &amp; Time
            </Label>
            <Input
              id="res-expiry"
              type="datetime-local"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* Advanced (collapsible) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RiArrowDownSLine
                  aria-hidden="true"
                  className={cn(
                    'size-3.5 transition-transform',
                    advancedOpen && 'rotate-180'
                  )}
                />
                Advanced options
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="grid gap-2">
                <Label htmlFor="res-parentIdTag" className="text-xs">
                  Parent ID Tag{' '}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="res-parentIdTag"
                  placeholder="e.g. FLEET-A"
                  value={parentIdTag}
                  onChange={(e) => setParentIdTag(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Group tag for fleet or shared authorization.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <RiLoader4Line
                  aria-hidden="true"
                  data-icon="inline-start"
                  className="animate-spin"
                />
                Reserving…
              </>
            ) : (
              <>
                <RiCalendarCheckLine
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Reserve Connector
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReservationsTab({
  chargerId,
  connectors,
}: {
  chargerId: string
  connectors: ConnectorDetail[]
}) {
  // TODO: replace with api("charger.listReservations", { id: chargerId })
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [pastOpen, setPastOpen] = useState(false)

  // Suppress unused variable warning while mock is in place
  void chargerId

  useEffect(() => {
    const t = setTimeout(() => {
      setReservations(generateMockReservations())
      setLoading(false)
    }, 500)
    return () => clearTimeout(t)
  }, [])

  function handleCreated(reservation: Reservation) {
    setReservations((prev) => [reservation, ...prev])
  }

  function handleCancel(reservationId: number) {
    setCancelling(reservationId)
    // TODO: replace with api("charger.cancelReservation", { id: chargerId, reservationId })
    setTimeout(() => {
      setReservations((prev) =>
        prev.map((r) =>
          r.reservationId === reservationId ? { ...r, status: 'Cancelled' } : r
        )
      )
      setCancelling(null)
      toast.success(`Reservation #${reservationId} cancelled`)
    }, 1000)
  }

  const activeReservations = reservations.filter((r) => r.status === 'Active')
  const pastReservations = reservations.filter((r) => r.status !== 'Active')

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Reservations</h3>
        <Button size="sm" onClick={() => setNewDialogOpen(true)}>
          <RiAddLine aria-hidden="true" data-icon="inline-start" />
          New Reservation
        </Button>
      </div>

      {/* Empty state */}
      {reservations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <RiCalendarCheckLine
            aria-hidden="true"
            className="size-10 text-muted-foreground/40"
          />
          <p className="mt-3 text-sm font-medium">No reservations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reserve a connector to hold it for a specific ID tag.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setNewDialogOpen(true)}
          >
            <RiAddLine aria-hidden="true" data-icon="inline-start" />
            Create First Reservation
          </Button>
        </div>
      )}

      {/* Active section */}
      {activeReservations.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Active
          </p>
          {activeReservations.map((r) => (
            <ReservationCard
              key={r.reservationId}
              reservation={r}
              onCancel={handleCancel}
              cancelling={cancelling}
            />
          ))}
        </div>
      )}

      {/* Past section (collapsible) */}
      {pastReservations.length > 0 && (
        <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase hover:text-foreground"
            >
              <RiArrowDownSLine
                aria-hidden="true"
                className={cn(
                  'size-3.5 transition-transform',
                  pastOpen && 'rotate-180'
                )}
              />
              Past ({pastReservations.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-2">
            {pastReservations.map((r) => (
              <ReservationCard
                key={r.reservationId}
                reservation={r}
                onCancel={handleCancel}
                cancelling={cancelling}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <NewReservationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        connectors={connectors}
        onCreated={handleCreated}
      />
    </div>
  )
}
