import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams, useFetcher, data } from 'react-router'
import {
  RiAddLine,
  RiSearchLine,
  RiBuilding2Line,
  RiFlashlightLine,
  RiDoorOpenLine,
  RiRefreshLine,
  RiPencilLine,
  RiPlugLine,
  RiMoreLine,
  RiDeleteBinLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiCpuLine,
} from '@remixicon/react'
import { toast } from 'sonner'

import { useSiteId } from '~/layouts/site'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Skeleton } from '~/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import useSWR from 'swr'
import { cn } from '~/lib/utils'
import {
  useRoomList,
  useFloorList,
  useRoomDetail,
  updateFloor,
  createRoom,
} from '~/hooks/use-rooms'
import { RoomCard, DeviceRow } from '~/components/rooms/room-card'
import {
  AddRoomDialog,
  EditRoomDialog,
  DeleteRoomDialog,
  AddFloorDialog,
  AssignDeviceDialog,
} from '~/components/rooms/room-dialogs'
import {
  formatPower,
  getFloorRoomSummary,
  getFloorSummaries,
} from '~/lib/room-helpers'
import {
  ROOM_TYPE_CONFIG,
  ROOM_TYPE_BAR_COLORS,
  type RoomItem,
} from '~/lib/room'
import { api } from '~/lib/api'

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  if (intent === 'delete-floor') {
    const siteId = formData.get('siteId') as string
    const level = Number(formData.get('level'))
    await api('floor.delete', { siteId, level })
    return data({ ok: true })
  }

  return data({ ok: false }, { status: 400 })
}

export default function Rooms() {
  const siteId = useSiteId()
  const { data: siteData } = useSWR(
    ['site.get', siteId],
    () => api<{ name: string }>('site.get', { id: siteId }),
  )
  const siteName = siteData?.name ?? 'Building'
  const [searchParams, setSearchParams] = useSearchParams()
  const activeLevel = Number(searchParams.get('floor') ?? '0')
  const setActiveLevel = useCallback(
    (level: number) => {
      setSearchParams((prev) => {
        prev.set('floor', String(level))
        return prev
      })
    },
    [setSearchParams],
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Dialog states
  const [addRoomOpen, setAddRoomOpen] = useState(false)
  const [addFloorOpen, setAddFloorOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<RoomItem | null>(null)
  const [deleteRoom, setDeleteRoom] = useState<RoomItem | null>(null)
  const [assignRoom, setAssignRoom] = useState<RoomItem | null>(null)

  // Floor devices panel
  const [showFloorDevices, setShowFloorDevices] = useState(false)

  // Inline floor name editing
  const [editingFloorName, setEditingFloorName] = useState(false)
  const [floorNameDraft, setFloorNameDraft] = useState('')

  function startEditingFloorName() {
    if (!activeFloor) return
    setFloorNameDraft(activeFloor.name)
    setEditingFloorName(true)
  }

  async function saveFloorName() {
    setEditingFloorName(false)
    if (!activeFloor) return
    const trimmed = floorNameDraft.trim()
    if (!trimmed || trimmed === activeFloor.name) return
    try {
      await updateFloor({ siteId, level: activeFloor.level, name: trimmed })
      toast.success('Floor renamed')
      mutateFloors()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to rename floor',
      )
    }
  }

  // Assign device to floor — find or create a distribution room
  async function assignDeviceToFloor() {
    if (!activeFloor) return
    const distRoom = rooms.find((r) => r.type === 'distribution')
    if (distRoom) {
      setAssignRoom(distRoom)
      return
    }
    try {
      const result = await createRoom({
        siteId,
        name: `${activeFloor.name} Distribution`,
        type: 'distribution',
        level: activeFloor.level,
      })
      await mutateRooms()
      // Find the newly created room after mutation
      setAssignRoom({
        id: result.id,
        siteId,
        name: `${activeFloor.name} Distribution`,
        type: 'distribution',
        level: activeFloor.level,
        deviceCount: 0,
        livePowerW: null,
        connectionStatus: 'offline',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create distribution room',
      )
    }
  }

  // Delete floor via action
  const deleteFloorFetcher = useFetcher()
  const isDeletingFloor = deleteFloorFetcher.state !== 'idle'

  useEffect(() => {
    if (deleteFloorFetcher.data?.ok) {
      toast.success('Floor deleted')
      mutate()
      const deletedLevel = Number(
        deleteFloorFetcher.formData?.get('level'),
      )
      const remaining = floors.filter((f) => f.level !== deletedLevel)
      if (remaining.length > 0) {
        setActiveLevel(remaining[0].level)
      } else {
        // No floors left — clear the param
        setSearchParams((prev) => {
          prev.delete('floor')
          return prev
        })
      }
    }
  }, [deleteFloorFetcher.data])

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

  // All rooms for building-wide summaries
  const { rooms: allRooms } = useRoomList(siteId)

  // Set initial active floor
  useEffect(() => {
    if (
      floors.length > 0 &&
      activeLevel === 0 &&
      !floors.some((f) => f.level === 0)
    ) {
      setActiveLevel(floors[0].level)
    }
  }, [floors, activeLevel])

  const mutate = useCallback(() => {
    mutateRooms()
    mutateFloors()
  }, [mutateRooms, mutateFloors])

  // Per-floor summaries from all rooms
  const floorSummaries = useMemo(
    () => getFloorSummaries(allRooms),
    [allRooms],
  )

  const siteSummary = getFloorRoomSummary(allRooms)
  const floorSummary = getFloorRoomSummary(rooms)
  const activeFloor = floors.find((f) => f.level === activeLevel) ?? floors[0]
  const isLoading = floorsLoading || roomsLoading

  // Dynamic floor status — replaces static label with live state
  const floorStatus = useMemo(() => {
    if (rooms.length === 0 && !roomsLoading)
      return { text: 'No rooms', color: 'text-muted-foreground' }
    const offline = rooms.filter(
      (r) => r.connectionStatus === 'offline',
    ).length
    const degraded = rooms.filter(
      (r) => r.connectionStatus === 'degraded',
    ).length
    if (offline > 0)
      return {
        text: `${offline} room${offline > 1 ? 's' : ''} offline`,
        color: 'text-red-500',
      }
    if (degraded > 0)
      return {
        text: `${degraded} degraded`,
        color: 'text-amber-500',
      }
    if (floorSummary.totalDevices === 0)
      return { text: 'No devices', color: 'text-muted-foreground' }
    return { text: 'All systems online', color: 'text-emerald-600' }
  }, [rooms, roomsLoading, floorSummary])

  // Sort floors descending (top floor first, basement last)
  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => b.level - a.level),
    [floors],
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Rooms & Distribution
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Building energy distribution by floor and room
        </p>
      </div>

      {/* Mobile Floor Selector */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden">
        {floorsLoading ? (
          <>
            <Skeleton className="h-14 w-28 shrink-0 rounded-lg" />
            <Skeleton className="h-14 w-28 shrink-0 rounded-lg" />
            <Skeleton className="h-14 w-28 shrink-0 rounded-lg" />
          </>
        ) : (
          <>
            {sortedFloors.map((floor) => {
              const summary = floorSummaries[floor.level]
              const isActive = floor.level === activeLevel
              return (
                <button
                  key={floor.level}
                  onClick={() => setActiveLevel(floor.level)}
                  className={cn(
                    'flex shrink-0 flex-col rounded-lg border px-3 py-2 text-left transition-all',
                    isActive
                      ? 'border-primary/40 bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      isActive && 'text-primary',
                    )}
                  >
                    {floor.name}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {formatPower(summary?.totalPowerW ?? 0)} ·{' '}
                    {summary?.roomCount ?? 0} rm
                  </span>
                </button>
              )
            })}
            <button
              onClick={() => setAddFloorOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <RiAddLine className="size-3.5" />
              Floor
            </button>
          </>
        )}
      </div>

      {/* Main Layout: Building Nav + Floor Detail */}
      <div className="flex gap-5">
        {/* Desktop Building Navigator */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-4 rounded-xl border bg-card">
            {/* Building header */}
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <RiBuilding2Line className="size-4 text-muted-foreground" />
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {siteName}
                </span>
              </div>
              {floorsLoading ? (
                <>
                  <Skeleton className="mt-1.5 h-6 w-24 rounded" />
                  <Skeleton className="mt-1.5 h-3 w-32 rounded" />
                </>
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {formatPower(siteSummary.totalPowerW)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {siteSummary.roomCount} rooms ·{' '}
                    {siteSummary.totalDevices} devices
                  </p>
                </>
              )}
            </div>

            {/* Floor list */}
            <div className="p-2">
              <div className="relative">
                {/* Vertical riser line — scoped to floor items only */}
                {sortedFloors.length > 1 && (
                  <div className="absolute top-4 bottom-4 left-[11px] w-0.5 rounded-full bg-border" />
                )}

                <div className="relative space-y-1">
                {floorsLoading ? (
                  <>
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </>
                ) : sortedFloors.length > 0 ? (
                  sortedFloors.map((floor) => {
                    const summary = floorSummaries[floor.level]
                    const isActive = floor.level === activeLevel
                    const powerRatio =
                      siteSummary.totalPowerW > 0
                        ? ((summary?.totalPowerW ?? 0) /
                            siteSummary.totalPowerW) *
                          100
                        : 0

                    return (
                      <button
                        key={floor.level}
                        onClick={() => setActiveLevel(floor.level)}
                        className={cn(
                          'relative flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ease-out',
                          isActive
                            ? 'bg-primary/5 shadow-sm ring-1 ring-primary/20 scale-[1.02]'
                            : 'scale-100 hover:bg-muted/50',
                        )}
                      >
                        {/* Riser dot */}
                        <div
                          className={cn(
                            'mt-1.5 shrink-0 rounded-full border-2 transition-all duration-200',
                            isActive
                              ? 'size-2.5 border-primary bg-primary shadow-[0_0_6px_rgba(99,102,241,0.4)]'
                              : 'size-2 border-muted-foreground/30 bg-background',
                          )}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-1">
                            <span
                              className={cn(
                                'truncate text-sm font-semibold transition-colors duration-200',
                                isActive
                                  ? 'text-primary'
                                  : 'text-foreground',
                              )}
                            >
                              {floor.name}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              L{floor.level}
                            </span>
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="font-medium tabular-nums">
                              {formatPower(summary?.totalPowerW ?? 0)}
                            </span>
                            <span>{summary?.roomCount ?? 0} rm</span>
                          </div>

                          {/* Power proportion bar */}
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                isActive
                                  ? 'bg-primary'
                                  : 'bg-muted-foreground/25',
                              )}
                              style={{
                                width: `${Math.max(powerRatio, 2)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    No floors yet
                  </p>
                )}
                </div>
              </div>
            </div>

            {/* Add Floor — always visible at bottom */}
            {!floorsLoading && (
              <div className="border-t p-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => setAddFloorOpen(true)}
                >
                  <RiAddLine className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* Floor Detail */}
        <main className="min-w-0 flex-1 space-y-4">
          {/* Floor Header */}
          {floorsLoading ? (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-32 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                  </div>
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <div className="flex items-center gap-5">
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-20 rounded" />
                    <Skeleton className="h-2.5 w-16 rounded" />
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-8 rounded" />
                    <Skeleton className="h-2.5 w-12 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-8 rounded" />
                    <Skeleton className="h-2.5 w-14 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ) : activeFloor && (
            <div key={activeLevel} className="animate-in fade-in slide-in-from-bottom-2 rounded-xl border bg-card duration-300">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      L{activeFloor.level}
                    </Badge>
                    {editingFloorName ? (
                      <input
                        value={floorNameDraft}
                        onChange={(e) => setFloorNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveFloorName()
                          if (e.key === 'Escape') setEditingFloorName(false)
                        }}
                        onBlur={saveFloorName}
                        autoFocus
                        className="box-border h-6 w-40 rounded-md border border-input bg-background px-2 text-base font-semibold outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    ) : (
                      <button
                        onClick={startEditingFloorName}
                        className="group/edit flex h-6 items-center gap-1.5 rounded-md px-1 transition-colors hover:bg-muted/50"
                      >
                        <h2 className="text-base font-semibold leading-6">
                          {activeFloor.name}
                        </h2>
                        <RiPencilLine className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100" />
                      </button>
                    )}
                  </div>
                  <p
                    className={cn(
                      'mt-0.5 flex items-center gap-1.5 text-xs',
                      floorStatus.color,
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block size-1.5 rounded-full',
                        floorStatus.color === 'text-emerald-600'
                          ? 'bg-emerald-500'
                          : floorStatus.color === 'text-amber-500'
                            ? 'bg-amber-500'
                            : floorStatus.color === 'text-red-500'
                              ? 'bg-red-500'
                              : 'bg-muted-foreground/50',
                      )}
                    />
                    {floorStatus.text}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-5">
                    <div className="text-center sm:text-right">
                      <div className="flex items-center gap-1.5">
                        <RiFlashlightLine className="size-3.5 text-violet-500" />
                        <p className="text-lg font-bold tabular-nums leading-none">
                          {formatPower(floorSummary.totalPowerW)}
                        </p>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Active Power
                      </p>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="text-center sm:text-right">
                      <p className="text-base font-semibold tabular-nums leading-none">
                        {floorSummary.roomCount}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Rooms
                      </p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-base font-semibold tabular-nums leading-none">
                        {floorSummary.totalDevices}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Devices
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="size-8 p-0">
                        <RiMoreLine className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={assignDeviceToFloor}>
                        <RiPlugLine className="mr-2 size-4" />
                        Assign Device
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAddRoomOpen(true)}>
                        <RiAddLine className="mr-2 size-4" />
                        Add Room
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <deleteFloorFetcher.Form method="post">
                        <input type="hidden" name="intent" value="delete-floor" />
                        <input type="hidden" name="siteId" value={siteId} />
                        <input type="hidden" name="level" value={activeFloor.level} />
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={isDeletingFloor}
                          onSelect={(e) => {
                            e.preventDefault()
                            const form = (e.target as HTMLElement).closest('form')
                            if (form) form.requestSubmit()
                          }}
                        >
                          <RiDeleteBinLine className="mr-2 size-4" />
                          {isDeletingFloor ? 'Deleting...' : 'Delete Floor'}
                        </DropdownMenuItem>
                      </deleteFloorFetcher.Form>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Power Distribution Bar */}
              {rooms.length > 0 && floorSummary.totalPowerW > 0 && (
                <div className="border-t px-4 py-3">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Power Distribution
                  </p>
                  <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted/50">
                    {rooms
                      .filter((r) => (r.livePowerW ?? 0) > 0)
                      .sort(
                        (a, b) =>
                          (b.livePowerW ?? 0) - (a.livePowerW ?? 0),
                      )
                      .map((room, i) => (
                        <div
                          key={room.id}
                          className={cn(
                            'floor-bar-segment h-full rounded-sm',
                            ROOM_TYPE_BAR_COLORS[room.type],
                          )}
                          style={{
                            width: `${((room.livePowerW ?? 0) / floorSummary.totalPowerW) * 100}%`,
                            minWidth: '4px',
                            animationDelay: `${i * 80}ms`,
                          }}
                          title={`${room.name}: ${formatPower(room.livePowerW)}`}
                        />
                      ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {rooms
                      .filter((r) => (r.livePowerW ?? 0) > 0)
                      .sort(
                        (a, b) =>
                          (b.livePowerW ?? 0) - (a.livePowerW ?? 0),
                      )
                      .map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground"
                        >
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              ROOM_TYPE_BAR_COLORS[room.type],
                            )}
                          />
                          <span className="truncate">{room.name}</span>
                          <span className="font-medium tabular-nums text-foreground/70">
                            {formatPower(room.livePowerW)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Floor Devices Toggle */}
              {floorSummary.totalDevices > 0 && (
                <button
                  onClick={() => setShowFloorDevices((v) => !v)}
                  className="flex w-full items-center justify-center gap-1.5 border-t py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                >
                  <RiCpuLine className="size-3.5" />
                  {showFloorDevices ? (
                    <>
                      <span>Hide devices</span>
                      <RiArrowUpSLine className="size-3.5" />
                    </>
                  ) : (
                    <>
                      <span>
                        {floorSummary.totalDevices} device
                        {floorSummary.totalDevices !== 1 ? 's' : ''} on
                        this floor
                      </span>
                      <RiArrowDownSLine className="size-3.5" />
                    </>
                  )}
                </button>
              )}

              {/* Floor Devices Panel — lazy loaded */}
              {showFloorDevices && (
                <div className="border-t bg-muted/10">
                  {rooms.length > 0 ? (
                    <div className="divide-y">
                      {rooms.map((room) => (
                        <FloorRoomDevices
                          key={room.id}
                          room={room}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No rooms on this floor
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="animate-in fade-in slide-in-from-bottom-1 relative duration-200 delay-100">
            <RiSearchLine className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>

          {/* Room Grid */}
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
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
          ) : (
            <div key={activeLevel} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room, i) => (
                <div
                  key={room.id}
                  className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-300"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <RoomCard
                    room={room}
                    floorPowerW={floorSummary.totalPowerW}
                    onEdit={(r) => setEditRoom(r)}
                    onDelete={(r) => setDeleteRoom(r)}
                    onAssignDevice={(r) => setAssignRoom(r)}
                  />
                </div>
              ))}
              {/* Add Room card */}
              <button
                onClick={() => setAddRoomOpen(true)}
                className="animate-in fade-in slide-in-from-bottom-3 flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors fill-mode-both duration-300 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                style={{ animationDelay: `${rooms.length * 50}ms` }}
              >
                <RiAddLine className="size-6" />
                <span className="text-sm font-medium">Add Room</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <AddRoomDialog
        open={addRoomOpen}
        onOpenChange={setAddRoomOpen}
        onSuccess={() => {
          mutate()
          setAddRoomOpen(false)
        }}
      />
      <EditRoomDialog
        open={editRoom !== null}
        onOpenChange={(open) => {
          if (!open) setEditRoom(null)
        }}
        room={editRoom}
        onSuccess={() => {
          mutate()
          setEditRoom(null)
        }}
      />
      <DeleteRoomDialog
        open={deleteRoom !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRoom(null)
        }}
        room={deleteRoom}
        onSuccess={() => {
          mutate()
          setDeleteRoom(null)
        }}
      />
      <AddFloorDialog
        open={addFloorOpen}
        onOpenChange={setAddFloorOpen}
        floors={floors}
        onSuccess={() => {
          mutate()
          setAddFloorOpen(false)
        }}
      />
      <AssignDeviceDialog
        open={assignRoom !== null}
        onOpenChange={(open) => {
          if (!open) setAssignRoom(null)
        }}
        room={assignRoom}
        onSuccess={mutate}
      />
    </div>
  )
}

// --- Floor-level device list per room (lazy-loaded) ---

function FloorRoomDevices({ room }: { room: RoomItem }) {
  const { data, isLoading } = useRoomDetail(room.id)
  const config = ROOM_TYPE_CONFIG[room.type]
  const Icon = config.icon

  return (
    <div>
      {/* Room label */}
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
        <Icon className={cn('size-3.5', config.color)} />
        <span className="font-medium text-foreground">{room.name}</span>
        <span>·</span>
        <span className="tabular-nums">{formatPower(room.livePowerW)}</span>
        <span>·</span>
        <span>{room.deviceCount} device{room.deviceCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Devices */}
      {isLoading ? (
        <div className="space-y-1 px-4 pb-2">
          <Skeleton className="h-8 w-full rounded" />
          <Skeleton className="h-8 w-full rounded" />
        </div>
      ) : (data?.devices ?? []).length > 0 ? (
        <div className="pb-1">
          {(data?.devices ?? []).map((device) => (
            <DeviceRow key={device.id} device={device} />
          ))}
        </div>
      ) : (
        <p className="px-4 pb-2 text-[10px] text-muted-foreground">
          No devices assigned
        </p>
      )}
    </div>
  )
}
