import { useEffect, useMemo, useState } from 'react'
import {
  RiAddLine,
  RiArrowDownLine,
  RiArrowUpLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
} from '@remixicon/react'
import { toast } from 'sonner'

import { useSearchParams } from 'react-router'
import { cn } from '~/lib/utils'
import { ROOM_TYPE_CONFIG } from '~/lib/room'
import type { RoomItem, RoomType, FloorItem } from '~/lib/room'
import { getRoomTypeOptions, connectionStatusDot } from '~/lib/room-helpers'
import {
  createRoom,
  updateRoom,
  deleteRoom,
  assignDevice,
  unassignDevice,
  createFloor,
  useAvailableDevices,
  useRoomDetail,
} from '~/hooks/use-rooms'
import { useSiteId } from '~/layouts/site'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

// --- Add Room Dialog ---

export function AddRoomDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const siteId = useSiteId()
  const [searchParams] = useSearchParams()
  const level = Number(searchParams.get('floor') ?? '0')
  const [name, setName] = useState('')
  const [type, setType] = useState<RoomType>('living')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setType('living')
    }
  }, [open])

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('Please enter a room name')
      return
    }
    setLoading(true)
    try {
      await createRoom({ siteId, name: name.trim(), type, level })
      toast.success(`Room "${name.trim()}" created`)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  const roomTypes = getRoomTypeOptions()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Room</DialogTitle>
          <DialogDescription>
            Create a new room to organize your devices spatially.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="add-room-name">Room Name</Label>
            <Input
              id="add-room-name"
              placeholder="e.g. Living Room, Home Office"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Room Type</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {roomTypes.map((rt) => {
                const cfg = ROOM_TYPE_CONFIG[rt.value]
                const Icon = cfg.icon
                return (
                  <button
                    key={rt.value}
                    onClick={() => setType(rt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition-colors',
                      type === rt.value
                        ? 'border-violet-500 bg-violet-500/10 text-violet-700'
                        : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="size-4" />
                    {rt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <RiCheckLine className="mr-1.5 size-4" />
            Create Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Edit Room Dialog ---

export function EditRoomDialog({
  open,
  onOpenChange,
  room,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: RoomItem | null
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<RoomType>('living')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && room) {
      setName(room.name)
      setType(room.type)
    }
  }, [open, room])

  async function handleSubmit() {
    if (!room) return
    if (!name.trim()) {
      toast.error('Please enter a room name')
      return
    }
    setLoading(true)
    try {
      await updateRoom({
        siteId: room.siteId,
        id: room.id,
        name: name.trim(),
        type,
      })
      toast.success('Room updated')
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update room')
    } finally {
      setLoading(false)
    }
  }

  const roomTypes = getRoomTypeOptions()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
          <DialogDescription>Update the room name or type.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-room-name">Room Name</Label>
            <Input
              id="edit-room-name"
              placeholder="e.g. Living Room, Home Office"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label>Room Type</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {roomTypes.map((rt) => {
                const cfg = ROOM_TYPE_CONFIG[rt.value]
                const Icon = cfg.icon
                return (
                  <button
                    key={rt.value}
                    onClick={() => setType(rt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] font-medium transition-colors',
                      type === rt.value
                        ? 'border-violet-500 bg-violet-500/10 text-violet-700'
                        : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="size-4" />
                    {rt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <RiCheckLine className="mr-1.5 size-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Delete Room Dialog ---

export function DeleteRoomDialog({
  open,
  onOpenChange,
  room,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: RoomItem | null
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!room) return
    setLoading(true)
    try {
      await deleteRoom(room.siteId, room.id)
      toast.success(`Room "${room.name}" deleted`)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Room</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">{room?.name}</span>?
            Devices assigned to this room will be unassigned.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            <RiCloseLine className="mr-1.5 size-4" />
            Delete Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Add Floor Dialog ---

type FloorPresetId = 'basement' | 'ground' | 'next' | 'rooftop' | 'custom'

interface FloorPreset {
  id: FloorPresetId
  label: string
  sublabel: string
  getLevel: (floors: FloorItem[]) => number
}

const FLOOR_PRESETS: FloorPreset[] = [
  {
    id: 'basement',
    label: 'Basement',
    sublabel: 'Level −1',
    getLevel: () => -1,
  },
  {
    id: 'ground',
    label: 'Ground',
    sublabel: 'Level 0',
    getLevel: () => 0,
  },
  {
    id: 'next',
    label: 'Next Floor',
    sublabel: 'Auto +1',
    getLevel: (floors) =>
      floors.length > 0 ? Math.max(...floors.map((f) => f.level)) + 1 : 1,
  },
  {
    id: 'rooftop',
    label: 'Rooftop',
    sublabel: 'Top level',
    getLevel: (floors) =>
      floors.length > 0 ? Math.max(...floors.map((f) => f.level)) + 1 : 2,
  },
]

const PRESET_NAMES: Record<FloorPresetId, string> = {
  basement: 'Basement',
  ground: 'Ground Floor',
  next: '',
  rooftop: 'Rooftop',
  custom: '',
}

export function AddFloorDialog({
  open,
  onOpenChange,
  floors,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  floors: FloorItem[]
  onSuccess: () => void
}) {
  const siteId = useSiteId()
  const [name, setName] = useState('')
  const [preset, setPreset] = useState<FloorPresetId>('next')
  const [customLevel, setCustomLevel] = useState('')
  const [loading, setLoading] = useState(false)

  const existingLevels = useMemo(
    () => new Set(floors.map((f) => f.level)),
    [floors]
  )

  const resolvedLevel = useMemo(() => {
    if (preset === 'custom') {
      const n = Number(customLevel)
      return isNaN(n) ? null : n
    }
    const p = FLOOR_PRESETS.find((x) => x.id === preset)
    return p ? p.getLevel(floors) : null
  }, [preset, customLevel, floors])

  // Build sorted preview list: existing floors + the new one (if level is valid)
  const previewFloors = useMemo(() => {
    const existing = floors.map((f) => ({ level: f.level, name: f.name, isNew: false }))
    if (resolvedLevel !== null && !existingLevels.has(resolvedLevel)) {
      existing.push({ level: resolvedLevel, name: name.trim() || '(new floor)', isNew: true })
    }
    return existing.sort((a, b) => b.level - a.level) // highest first (top of building)
  }, [floors, resolvedLevel, existingLevels, name])

  const levelConflict = resolvedLevel !== null && existingLevels.has(resolvedLevel)

  useEffect(() => {
    if (!open) {
      setName('')
      setPreset('next')
      setCustomLevel('')
    }
  }, [open])

  // When switching to a named preset, pre-fill name if still empty
  useEffect(() => {
    const suggested = PRESET_NAMES[preset]
    if (suggested && !name) {
      setName(suggested)
    }
  }, [preset]) // intentionally exclude `name` — only trigger on preset change

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('Please enter a floor name')
      return
    }
    if (resolvedLevel === null || isNaN(resolvedLevel)) {
      toast.error('Level must be a valid number')
      return
    }
    if (levelConflict) {
      toast.error(`Level ${resolvedLevel} already exists`)
      return
    }
    setLoading(true)
    try {
      await createFloor({ siteId, name: name.trim(), level: resolvedLevel })
      toast.success(`Floor "${name.trim()}" created`)
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create floor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Floor</DialogTitle>
          <DialogDescription>
            Add a new floor level to organize rooms vertically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-1">
          {/* Preset quick-select */}
          <div className="grid gap-2">
            <Label>Floor Type</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {FLOOR_PRESETS.map((p) => {
                const level = p.getLevel(floors)
                const conflict = existingLevels.has(level)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id)}
                    disabled={conflict}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-[11px] font-medium transition-colors',
                      conflict && 'pointer-events-none opacity-40',
                      preset === p.id && !conflict
                        ? 'border-violet-500 bg-violet-500/10 text-violet-700'
                        : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <span className="text-[12px] font-semibold leading-none">{p.label}</span>
                    <span className="text-[10px] opacity-70">{p.sublabel}</span>
                  </button>
                )
              })}
            </div>

            {/* Custom level row */}
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={cn(
                'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-[12px] transition-colors',
                preset === 'custom'
                  ? 'border-violet-500 bg-violet-500/10 text-violet-700'
                  : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="font-medium">Custom level</span>
              {preset === 'custom' && (
                <input
                  type="number"
                  className="ml-auto w-16 rounded border border-border bg-background px-2 py-0.5 text-right text-[12px] text-foreground outline-none focus:ring-1 focus:ring-violet-500"
                  value={customLevel}
                  onChange={(e) => setCustomLevel(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="e.g. 3"
                  autoFocus
                />
              )}
              {preset !== 'custom' && (
                <span className="ml-auto text-[10px] opacity-60">integer</span>
              )}
            </button>

            {levelConflict && (
              <p className="text-[11px] text-destructive">
                Level {resolvedLevel} is already taken. Choose a different level.
              </p>
            )}
          </div>

          {/* Floor name */}
          <div className="grid gap-2">
            <Label htmlFor="floor-name">Floor Name</Label>
            <Input
              id="floor-name"
              placeholder="e.g. Second Floor, Basement"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus={preset !== 'custom'}
            />
          </div>

          {/* Building stack preview */}
          {previewFloors.length > 0 && (
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                Building Stack
                <span className="text-[10px] font-normal text-muted-foreground">
                  — preview
                </span>
              </Label>
              <div className="overflow-hidden rounded-md border border-border">
                {/* Up indicator */}
                <div className="flex items-center justify-center gap-1 border-b border-dashed border-border bg-muted/30 py-1 text-[10px] text-muted-foreground">
                  <RiArrowUpLine className="size-3" />
                  higher
                </div>

                <div className="divide-y divide-border/60">
                  {previewFloors.map((f) => (
                    <div
                      key={f.level}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 text-[12px]',
                        f.isNew
                          ? 'bg-violet-500/8 font-semibold text-violet-700'
                          : 'text-foreground/80'
                      )}
                    >
                      <span
                        className={cn(
                          'w-8 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-mono font-medium',
                          f.isNew
                            ? 'bg-violet-500/15 text-violet-700'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {f.level >= 0 ? `+${f.level}` : f.level}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      {f.isNew && (
                        <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600">
                          new
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Down indicator */}
                <div className="flex items-center justify-center gap-1 border-t border-dashed border-border bg-muted/30 py-1 text-[10px] text-muted-foreground">
                  <RiArrowDownLine className="size-3" />
                  lower
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || levelConflict || resolvedLevel === null}
          >
            <RiCheckLine className="mr-1.5 size-4" />
            Create Floor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Assign Device Dialog ---

export function AssignDeviceDialog({
  open,
  onOpenChange,
  room,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: RoomItem | null
  onSuccess: () => void
}) {
  const siteId = useSiteId()
  const [search, setSearch] = useState('')
  const { devices, isLoading } = useAvailableDevices(siteId, search)
  const { data: roomDetail } = useRoomDetail(open && room ? room.id : null)

  const assignedIds = new Set((roomDetail?.devices ?? []).map((d) => d.id))

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  async function handleAssign(deviceId: string, deviceName: string) {
    if (!room) return
    try {
      await assignDevice({ siteId, roomId: room.id, deviceId })
      toast.success(`${deviceName} assigned to ${room.name}`)
      onSuccess()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to assign device'
      )
    }
  }

  async function handleUnassign(deviceId: string, deviceName: string) {
    if (!room) return
    try {
      await unassignDevice({ siteId, roomId: room.id, deviceId })
      toast.success(`${deviceName} removed from ${room.name}`)
      onSuccess()
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to unassign device'
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Device to {room?.name ?? 'Room'}</DialogTitle>
          <DialogDescription>
            Select devices to place in this room.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <RiSearchLine className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="-mx-1 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading devices...
            </p>
          ) : devices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No devices found
            </p>
          ) : (
            <div className="space-y-1 px-1">
              {devices.map((device) => {
                const isAssigned = assignedIds.has(device.id)
                return (
                  <div
                    key={device.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                  >
                    <div className="relative shrink-0">
                      <div className="flex size-8 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground uppercase">
                        {device.type.slice(0, 2)}
                      </div>
                      <span
                        className={cn(
                          'absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-2 border-background',
                          connectionStatusDot(device.connectionStatus)
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {device.type} · {device.connectionStatus}
                      </p>
                    </div>
                    {isAssigned ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => handleUnassign(device.id, device.name)}
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs"
                        onClick={() => handleAssign(device.id, device.name)}
                      >
                        <RiAddLine className="mr-1 size-3.5" />
                        Assign
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
