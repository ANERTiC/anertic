import {
  RiSofaLine,
  RiHotelBedLine,
  RiFridgeLine,
  RiDropLine,
  RiComputerLine,
  RiCarLine,
  RiShirtLine,
  RiArchiveLine,
  RiLeafLine,
  RiGridLine,
  RiPlugLine,
  RiCommunityLine,
} from '@remixicon/react'

import type { ConnectionStatus } from '~/lib/device'

export type { ConnectionStatus } from '~/lib/device'

// --- Types ---

export type RoomType =
  | 'distribution'
  | 'common_area'
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'office'
  | 'garage'
  | 'laundry'
  | 'storage'
  | 'outdoor'
  | 'other'

export interface RoomItem {
  id: string
  siteId: string
  name: string
  type: RoomType
  level: number
  deviceCount: number
  livePowerW: number | null
  connectionStatus: ConnectionStatus
  createdAt: string
  updatedAt: string
}

export interface RoomDeviceItem {
  id: string
  name: string
  type: string
  tag: string
  connectionStatus: ConnectionStatus
  meterCount: number
  lastSeenAt: string | null
}

export interface RoomGetResult extends RoomItem {
  devices: RoomDeviceItem[]
}

export interface FloorItem {
  siteId: string
  name: string
  level: number
  createdAt: string
  updatedAt: string
}

// --- Config Maps ---

export const ROOM_TYPE_CONFIG: Record<
  RoomType,
  { label: string; icon: typeof RiSofaLine; color: string; bg: string }
> = {
  distribution: {
    label: 'Distribution',
    icon: RiPlugLine,
    color: 'text-rose-600',
    bg: 'bg-rose-500/10',
  },
  common_area: {
    label: 'Common Area',
    icon: RiCommunityLine,
    color: 'text-sky-600',
    bg: 'bg-sky-500/10',
  },
  living: {
    label: 'Living Room',
    icon: RiSofaLine,
    color: 'text-indigo-600',
    bg: 'bg-indigo-500/10',
  },
  bedroom: {
    label: 'Bedroom',
    icon: RiHotelBedLine,
    color: 'text-violet-600',
    bg: 'bg-violet-500/10',
  },
  kitchen: {
    label: 'Kitchen',
    icon: RiFridgeLine,
    color: 'text-orange-600',
    bg: 'bg-orange-500/10',
  },
  bathroom: {
    label: 'Bathroom',
    icon: RiDropLine,
    color: 'text-cyan-600',
    bg: 'bg-cyan-500/10',
  },
  office: {
    label: 'Office',
    icon: RiComputerLine,
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
  },
  garage: {
    label: 'Garage',
    icon: RiCarLine,
    color: 'text-zinc-600',
    bg: 'bg-zinc-500/10',
  },
  laundry: {
    label: 'Laundry',
    icon: RiShirtLine,
    color: 'text-teal-600',
    bg: 'bg-teal-500/10',
  },
  storage: {
    label: 'Storage',
    icon: RiArchiveLine,
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
  },
  outdoor: {
    label: 'Outdoor',
    icon: RiLeafLine,
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
  },
  other: {
    label: 'Other',
    icon: RiGridLine,
    color: 'text-gray-600',
    bg: 'bg-gray-500/10',
  },
}

export const ROOM_TYPE_BAR_COLORS: Record<RoomType, string> = {
  distribution: 'bg-rose-500',
  common_area: 'bg-sky-500',
  living: 'bg-indigo-500',
  bedroom: 'bg-violet-500',
  kitchen: 'bg-orange-500',
  bathroom: 'bg-cyan-500',
  office: 'bg-blue-500',
  garage: 'bg-zinc-400',
  laundry: 'bg-teal-500',
  storage: 'bg-amber-500',
  outdoor: 'bg-emerald-500',
  other: 'bg-gray-400',
}

export const ROOM_STATUS_CONFIG: Record<
  ConnectionStatus,
  { label: string; color: string; dot: string }
> = {
  online: { label: 'Online', color: 'text-emerald-700', dot: 'bg-emerald-500' },
  offline: {
    label: 'Offline',
    color: 'text-muted-foreground',
    dot: 'bg-muted-foreground/50',
  },
  degraded: { label: 'Degraded', color: 'text-amber-700', dot: 'bg-amber-500' },
}
