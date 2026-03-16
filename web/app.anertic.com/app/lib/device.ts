import {
  RiCpuLine,
  RiSunLine,
  RiPlugLine,
  RiFlashlightLine,
  RiDashboard3Line,
} from "@remixicon/react"

// --- Types ---

export type DeviceType = "inverter" | "solar_panel" | "appliance" | "meter"
export type ConnectionStatus = "online" | "offline" | "degraded"
export type MeterChannel = "pv" | "grid" | "battery" | "ev" | "load"

export interface Device {
  id: string
  siteId: string
  name: string
  type: DeviceType
  tag: string
  brand: string
  model: string
  isActive: boolean
  createdAt: string
}

// Extended device with connection/runtime fields (from list API)
export interface DeviceListItem extends Device {
  connectionStatus: ConnectionStatus
  lastSeenAt: string | null
  meterCount: number
  dataPointsToday: number
}

// --- Config Maps ---

export const DEVICE_TYPE_CONFIG: Record<
  DeviceType,
  { label: string; icon: typeof RiCpuLine; color: string; bg: string }
> = {
  inverter: { label: "Inverter", icon: RiFlashlightLine, color: "text-violet-600", bg: "bg-violet-500/10" },
  solar_panel: { label: "Solar Panel", icon: RiSunLine, color: "text-amber-600", bg: "bg-amber-500/10" },
  meter: { label: "Energy Meter", icon: RiDashboard3Line, color: "text-cyan-600", bg: "bg-cyan-500/10" },
  appliance: { label: "Appliance", icon: RiPlugLine, color: "text-emerald-600", bg: "bg-emerald-500/10" },
}

export const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; dot: string }> = {
  online: { label: "Online", color: "text-emerald-700", dot: "bg-emerald-500" },
  offline: { label: "Offline", color: "text-muted-foreground", dot: "bg-muted-foreground/50" },
  degraded: { label: "Degraded", color: "text-amber-700", dot: "bg-amber-500" },
}

// Suggested channels per device type
export const DEVICE_CHANNEL_HINTS: Record<DeviceType, MeterChannel[]> = {
  inverter: ["pv", "grid", "battery", "load"],
  solar_panel: ["pv"],
  appliance: ["load", "ev"],
  meter: ["load", "grid"],
}

// --- Helpers ---

export function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never"
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
