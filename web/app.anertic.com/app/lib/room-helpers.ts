import type { RoomItem, RoomType, FloorItem } from '~/lib/room'

export function formatPower(watts: number | null): string {
  if (watts === null) return '—'
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`
  return `${Math.round(watts)} W`
}

export function formatEnergy(kwh: number): string {
  if (kwh >= 100) return `${Math.round(kwh)} kWh`
  return `${kwh.toFixed(1)} kWh`
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'Now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function connectionStatusDot(status: string): string {
  switch (status) {
    case 'online':
      return 'bg-emerald-500'
    case 'degraded':
      return 'bg-amber-500'
    default:
      return 'bg-gray-400'
  }
}

export function connectionStatusBadge(status: string): string {
  switch (status) {
    case 'online':
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
    case 'degraded':
      return 'bg-amber-500/10 text-amber-700 border-amber-200'
    default:
      return 'bg-gray-100 text-gray-500 border-gray-200'
  }
}

export function getFloorRoomSummary(rooms: RoomItem[]): {
  totalDevices: number
  totalPowerW: number
  roomCount: number
} {
  return {
    roomCount: rooms.length,
    totalDevices: rooms.reduce((sum, r) => sum + r.deviceCount, 0),
    totalPowerW: rooms.reduce((sum, r) => sum + (r.livePowerW ?? 0), 0),
  }
}

export function getRoomTypeOptions(): { value: RoomType; label: string }[] {
  return [
    { value: 'distribution', label: 'Distribution' },
    { value: 'common_area', label: 'Common Area' },
    { value: 'living', label: 'Living Room' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'office', label: 'Office' },
    { value: 'garage', label: 'Garage' },
    { value: 'laundry', label: 'Laundry' },
    { value: 'storage', label: 'Storage' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'other', label: 'Other' },
  ]
}
