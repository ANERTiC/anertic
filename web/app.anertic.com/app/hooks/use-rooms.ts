import useSWR from 'swr'
import { api } from '~/lib/api'
import type { RoomItem, RoomGetResult, FloorItem, RoomType } from '~/lib/room'
import type { DeviceListItem } from '~/lib/device'

// ---- useRoomList ----

interface RoomListOpts {
  type?: RoomType
  search?: string
  level?: number
}

export function useRoomList(siteId: string, opts: RoomListOpts = {}) {
  const { type, search, level } = opts
  const { data, isLoading, error, mutate } = useSWR(
    ['room.list', siteId, type, search, level],
    () =>
      api<{ items: RoomItem[] }>('room.list', {
        siteId,
        type: type || undefined,
        search: search?.trim() || undefined,
        level: level ?? undefined,
      })
  )
  return { rooms: data?.items ?? [], isLoading, error, mutate }
}

// ---- useRoomDetail ----

export function useRoomDetail(roomId: string | null) {
  const { data, isLoading, error, mutate } = useSWR(
    roomId ? ['room.get', roomId] : null,
    () => api<RoomGetResult>('room.get', { id: roomId })
  )
  return { data: data ?? null, isLoading, error, mutate }
}

// ---- useFloorList ----

export function useFloorList(siteId: string) {
  const { data, isLoading, error, mutate } = useSWR(
    ['floor.list', siteId],
    () => api<{ items: FloorItem[] }>('floor.list', { siteId })
  )
  return { floors: data?.items ?? [], isLoading, error, mutate }
}

// ---- useAvailableDevices ----

export function useAvailableDevices(siteId: string, search?: string) {
  const { data, isLoading } = useSWR(['device.list', siteId, search], () =>
    api<{ items: DeviceListItem[] }>('device.list', {
      siteId,
      search: search?.trim() || undefined,
    })
  )
  return { devices: data?.items ?? [], isLoading }
}

// ---- Mutation helpers ----

export async function createRoom(params: {
  siteId: string
  name: string
  type: RoomType
}): Promise<{ id: string }> {
  return api<{ id: string }>('room.create', params)
}

export async function updateRoom(params: {
  siteId: string
  id: string
  name?: string
  type?: RoomType
}): Promise<void> {
  await api('room.update', params)
}

export async function deleteRoom(siteId: string, id: string): Promise<void> {
  await api('room.delete', { siteId, id })
}

export async function assignDevice(params: {
  siteId: string
  roomId: string
  deviceId: string
}): Promise<void> {
  await api('room.assignDevice', params)
}

export async function unassignDevice(params: {
  siteId: string
  roomId: string
  deviceId: string
}): Promise<void> {
  await api('room.unassignDevice', params)
}

export async function createFloor(params: {
  siteId: string
  name: string
  level: number
}): Promise<FloorItem> {
  return api<FloorItem>('floor.create', params)
}

export async function updateFloor(params: {
  siteId: string
  level: number
  name?: string
}): Promise<FloorItem> {
  return api<FloorItem>('floor.update', params)
}

export async function deleteFloor(params: {
  siteId: string
  level: number
}): Promise<void> {
  return api<void>('floor.delete', params)
}
