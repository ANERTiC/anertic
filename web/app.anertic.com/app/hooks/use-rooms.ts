import useSWR from 'swr'
import { fetcher } from '~/lib/api'
import type {
  RoomItem,
  RoomGetResult,
  FloorItem,
  FloorGetResult,
  RoomType,
} from '~/lib/room'
import type { DeviceListItem } from '~/lib/device'

// ---- useRoomList ----

interface RoomListOpts {
  type?: RoomType
  search?: string
  level?: number
}

export function useRoomList(siteId: string, opts: RoomListOpts = {}) {
  const { type, search, level } = opts
  const { data, isLoading, error, mutate } = useSWR<{ items: RoomItem[] }>(
    [
      'room.list',
      {
        siteId,
        type: type || undefined,
        search: search?.trim() || undefined,
        level: level ?? undefined,
      },
    ],
    fetcher
  )
  return { rooms: data?.items ?? [], isLoading, error, mutate }
}

// ---- useRoomDetail ----

export function useRoomDetail(roomId: string | null) {
  const { data, isLoading, error, mutate } = useSWR<RoomGetResult>(
    roomId ? ['room.get', { id: roomId }] : null,
    fetcher
  )
  return { data: data ?? null, isLoading, error, mutate }
}

// ---- useFloorList ----

export function useFloorList(siteId: string, fallbackData?: FloorItem[]) {
  const { data, isLoading, error, mutate } = useSWR<{ items: FloorItem[] }>(
    ['floor.list', { siteId }],
    fetcher,
    fallbackData?.length ? { fallbackData: { items: fallbackData } } : undefined
  )
  const hasData = !!data || (fallbackData?.length ?? 0) > 0
  return { floors: data?.items ?? fallbackData ?? [], isLoading: isLoading && !hasData, error, mutate }
}

// ---- useAvailableDevices ----

export function useAvailableDevices(siteId: string, search?: string) {
  const { data, isLoading } = useSWR<{ items: DeviceListItem[] }>(
    ['device.list', { siteId, search: search?.trim() || undefined }],
    fetcher
  )
  return { devices: data?.items ?? [], isLoading }
}

// ---- useFloorDetail ----

export function useFloorDetail(siteId: string, level: number | null) {
  const { data, isLoading, error, mutate } = useSWR<FloorGetResult>(
    level !== null ? ['floor.get', { siteId, level }] : null,
    fetcher
  )
  return { data: data ?? null, isLoading, error, mutate }
}

// ---- Mutation helpers ----

export async function createRoom(params: {
  siteId: string
  name: string
  type: RoomType
  level?: number
}): Promise<{ id: string }> {
  return fetcher<{ id: string }>(['room.create', params])
}

export async function updateRoom(params: {
  siteId: string
  id: string
  name?: string
  type?: RoomType
}): Promise<void> {
  await fetcher(['room.update', params])
}

export async function deleteRoom(siteId: string, id: string): Promise<void> {
  await fetcher(['room.delete', { siteId, id }])
}

export async function assignDevice(params: {
  siteId: string
  roomId: string
  deviceId: string
}): Promise<void> {
  await fetcher(['room.assignDevice', params])
}

export async function unassignDevice(params: {
  siteId: string
  roomId: string
  deviceId: string
}): Promise<void> {
  await fetcher(['room.unassignDevice', params])
}

export async function createFloor(params: {
  siteId: string
  name: string
  level: number
}): Promise<FloorItem> {
  return fetcher<FloorItem>(['floor.create', params])
}

export async function updateFloor(params: {
  siteId: string
  level: number
  name?: string
}): Promise<{ item: FloorItem }> {
  return fetcher<{ item: FloorItem }>(['floor.update', params])
}

export async function assignFloorDevice(params: {
  siteId: string
  level: number
  deviceId: string
}): Promise<void> {
  await fetcher(['floor.assignDevice', params])
}

export async function unassignFloorDevice(params: {
  siteId: string
  level: number
  deviceId: string
}): Promise<void> {
  await fetcher(['floor.unassignDevice', params])
}

export async function deleteFloor(params: {
  siteId: string
  level: number
}): Promise<void> {
  await fetcher(['floor.delete', params])
}
