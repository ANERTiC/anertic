import { useEffect, useState, useCallback } from 'react'
import {
  RiAddLine,
  RiSearchLine,
  RiBuilding2Line,
  RiFlashlightLine,
  RiDoorOpenLine,
  RiCpuLine,
  RiLayoutGridLine,
  RiListCheck2,
  RiRefreshLine,
} from '@remixicon/react'

import { useSiteId } from '~/layouts/site'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Card, CardContent } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { cn } from '~/lib/utils'
import { useRoomList, useFloorList } from '~/hooks/use-rooms'
import { RoomCard, RoomListItem } from '~/components/rooms/room-card'
import {
  AddRoomDialog,
  EditRoomDialog,
  DeleteRoomDialog,
  AddFloorDialog,
  AssignDeviceDialog,
} from '~/components/rooms/room-dialogs'
import { formatPower, getFloorRoomSummary } from '~/lib/room-helpers'
import { type RoomItem } from '~/lib/room'

export default function Rooms() {
  const siteId = useSiteId()
  const [activeLevel, setActiveLevel] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Dialog states
  const [addRoomOpen, setAddRoomOpen] = useState(false)
  const [addFloorOpen, setAddFloorOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<RoomItem | null>(null)
  const [deleteRoom, setDeleteRoom] = useState<RoomItem | null>(null)
  const [assignRoom, setAssignRoom] = useState<RoomItem | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const {
    floors,
    isLoading: floorsLoading,
    mutate: mutateFloors,
  } = useFloorList(siteId)
  const {
    rooms,
    isLoading: roomsLoading,
    error: roomsError,
    mutate: mutateRooms,
  } = useRoomList(siteId, {
    level: activeLevel,
    search: debouncedSearch || undefined,
  })

  // All rooms for site-wide summary strip
  const { rooms: allRooms } = useRoomList(siteId)

  // Set initial active floor: prefer level 0, else first floor
  useEffect(() => {
    if (floors.length > 0 && activeLevel === 0 && !floors.some((f) => f.level === 0)) {
      setActiveLevel(floors[0].level)
    }
  }, [floors, activeLevel])

  const mutate = useCallback(() => {
    mutateRooms()
    mutateFloors()
  }, [mutateRooms, mutateFloors])

  const activeFloor = floors.find((f) => f.level === activeLevel) ?? floors[0]
  const floorSummary = getFloorRoomSummary(rooms)
  const siteSummary = getFloorRoomSummary(allRooms)

  const isLoading = floorsLoading || roomsLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Rooms
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Organize devices by floor and room to monitor energy usage spatially
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddFloorOpen(true)}
          >
            <RiBuilding2Line className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add Floor</span>
          </Button>
          <Button size="sm" onClick={() => setAddRoomOpen(true)}>
            <RiAddLine className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Add Room</span>
          </Button>
        </div>
      </div>

      {/* Site-wide Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
              <RiFlashlightLine className="size-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Live Power</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatPower(siteSummary.totalPowerW)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <RiCpuLine className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Devices</p>
              <p className="text-lg font-semibold tabular-nums">
                {siteSummary.totalDevices}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 py-0 lg:col-span-1">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <RiDoorOpenLine className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Rooms</p>
              <p className="text-lg font-semibold tabular-nums">
                {siteSummary.roomCount}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  across {floors.length} floors
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floor Tabs + Search/View toggle */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {floorsLoading ? (
          <div className="flex gap-1">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        ) : floors.length > 0 ? (
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
            {floors.map((floor) => {
              const isActive = floor.level === activeLevel
              return (
                <button
                  key={floor.level}
                  onClick={() => setActiveLevel(floor.level)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {floor.name}
                </button>
              )
            })}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <div className="relative">
            <RiSearchLine className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[200px] pl-8 text-sm"
            />
          </div>

          <div className="flex items-center rounded-md border p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded p-1 transition-colors',
                viewMode === 'grid'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <RiLayoutGridLine className="size-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded p-1 transition-colors',
                viewMode === 'list'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <RiListCheck2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floor Summary Bar */}
      {activeFloor && !floorsLoading && (
        <div className="flex items-center gap-6 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <RiBuilding2Line className="size-4" />
            <span className="font-medium text-foreground">
              {activeFloor.name}
            </span>
            <span className="text-xs">(Level {activeFloor.level})</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              <strong className="text-foreground">
                {formatPower(floorSummary.totalPowerW)}
              </strong>{' '}
              live
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">
                {floorSummary.roomCount}
              </strong>{' '}
              rooms
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">
                {floorSummary.totalDevices}
              </strong>{' '}
              devices
            </span>
          </div>
        </div>
      )}

      {/* Room Grid / List */}
      {isLoading ? (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'space-y-2'
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : roomsError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <p className="text-sm font-medium text-muted-foreground">
            Failed to load rooms
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => mutateRooms()}
          >
            <RiRefreshLine className="mr-1.5 size-4" />
            Retry
          </Button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <RiDoorOpenLine className="size-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {debouncedSearch
              ? 'No rooms match your search'
              : 'No rooms on this floor'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {debouncedSearch
              ? 'Try a different search term'
              : 'Add a room to start organizing devices'}
          </p>
          {!debouncedSearch && (
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setAddRoomOpen(true)}
            >
              <RiAddLine className="mr-1.5 size-4" />
              Add Room
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEdit={(r) => setEditRoom(r)}
              onDelete={(r) => setDeleteRoom(r)}
              onAssignDevice={(r) => setAssignRoom(r)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => (
            <RoomListItem
              key={room.id}
              room={room}
              onEdit={(r) => setEditRoom(r)}
              onDelete={(r) => setDeleteRoom(r)}
              onAssignDevice={(r) => setAssignRoom(r)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddRoomDialog
        open={addRoomOpen}
        onOpenChange={setAddRoomOpen}
        onSuccess={() => { mutate(); setAddRoomOpen(false) }}
      />
      <EditRoomDialog
        open={editRoom !== null}
        onOpenChange={(open) => { if (!open) setEditRoom(null) }}
        room={editRoom}
        onSuccess={() => { mutate(); setEditRoom(null) }}
      />
      <DeleteRoomDialog
        open={deleteRoom !== null}
        onOpenChange={(open) => { if (!open) setDeleteRoom(null) }}
        room={deleteRoom}
        onSuccess={() => { mutate(); setDeleteRoom(null) }}
      />
      <AddFloorDialog
        open={addFloorOpen}
        onOpenChange={setAddFloorOpen}
        floors={floors}
        onSuccess={() => { mutate(); setAddFloorOpen(false) }}
      />
      <AssignDeviceDialog
        open={assignRoom !== null}
        onOpenChange={(open) => { if (!open) setAssignRoom(null) }}
        room={assignRoom}
        onSuccess={mutate}
      />
    </div>
  )
}
