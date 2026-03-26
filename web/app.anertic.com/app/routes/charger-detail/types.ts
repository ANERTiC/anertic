import { useOutletContext } from 'react-router'

// --- Charger Types ---

export interface Charger {
  id: string
  siteId: string
  chargePointId: string
  ocppVersion: string
  status: string
  registrationStatus: string
  connectorCount: number
  maxPowerKw: string
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
  currentPowerKw: string
  todayEnergyKwh: string
  todaySessions: number
  totalEnergyKwh: string
  totalSessions: number
  connectors: ConnectorDetail[]
}

export interface ConnectorDetail {
  id: number
  status: string
  powerKw: string
  maxPowerKw: string
  connectorType: string
  errorCode: string
  vehicleId?: string
  sessionStartedAt?: string
  sessionKwh: string
  lastStatusAt: string | null
  transactionId: number | null
}

export interface Session {
  id: string
  connectorId: number
  startedAt: string
  endedAt: string | null
  energyKwh: string
  maxPowerKw: string
  idTag: string
  status: string
  meterStart: number
  meterStop: number | null
  stopReason: string | null
  transactionId: number
}

export interface OcppEvent {
  messageId: string
  action: string
  direction: 'in' | 'out'
  requestAt: string
  responseAt: string | null
  durationMs: number | null
  request: string | null
  response: string | null
  responseType: number | null
  errorCode: string | null
  errorDesc: string | null
}

export interface Reservation {
  id: string
  reservationId: number
  connectorId: number
  idTag: string
  parentIdTag: string | null
  expiryDate: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ChargingSchedulePeriod {
  startPeriod: number
  limit: string
  numberPhases: number | null
}

export interface ChargingScheduleData {
  duration: number | null
  startSchedule: string
  chargingRateUnit: string
  chargingSchedulePeriod: ChargingSchedulePeriod[]
  minChargingRate: string | null
}

export interface ChargingProfileData {
  id: string
  chargerId: string
  connectorId: number
  chargingProfileId: number
  stackLevel: number
  chargingProfilePurpose: string
  chargingProfileKind: string
  recurrencyKind: string
  validFrom: string | null
  validTo: string | null
  transactionId: number | null
  schedule: ChargingScheduleData | null
  createdAt: string
  updatedAt: string
}

export interface DailyEnergy {
  date: string
  energyKwh: string
  sessions: number
  peakPowerKw: string
}

export interface HourlyPower {
  hour: number
  powerKw: string
  energyKwh: string
}

export interface AnalyticsSummary {
  totalKwh: string
  totalSessions: number
  avgDailyKwh: string
  avgSessionKwh: string
  peakPowerKw: string
}

export interface AnalyticsResult {
  daily: DailyEnergy[]
  hourly: HourlyPower[]
  summary: AnalyticsSummary
}

export interface AuthTag {
  id: string
  idTag: string
  parentIdTag: string
  status: string
  expiryDate: string | null
  inLocalList: boolean
  createdAt: string
  updatedAt: string
}

export type ReservationActionData = {
  ok: boolean
  intent: string
  reservationId?: number
}

// --- Outlet Context ---

export interface ChargerOutletContext {
  charger: Charger
}

export function useChargerContext() {
  return useOutletContext<ChargerOutletContext>()
}

// --- Helpers ---

export function dailyLabel(
  date: string,
  index: number,
  total: number
): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const d = new Date(date)
  return index === total - 1 ? 'Today' : days[d.getDay()]
}

export function statusColor(status: string) {
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

export function statusDot(status: string) {
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

export function registrationColor(status: string) {
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

export function reservationStatusColor(status: string) {
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

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function formatPower(kw: number): string {
  if (kw >= 100) return `${Math.round(kw)} kW`
  if (kw >= 10) return `${kw.toFixed(1)} kW`
  return `${kw.toFixed(2)} kW`
}

export function formatEnergy(kwh: number): string {
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(1)} MWh`
  if (kwh >= 100) return `${Math.round(kwh)} kWh`
  return `${kwh.toFixed(1)} kWh`
}

export function sessionDuration(
  startedAt: string,
  endedAt?: string | null
): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const diff = end - new Date(startedAt).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(dateStr: string): string {
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

export const OCPP_BASE_URL = 'wss://ocpp.anertic.com'
