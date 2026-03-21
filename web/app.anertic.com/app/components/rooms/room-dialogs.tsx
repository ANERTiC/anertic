import { useEffect, useState } from 'react'
import {
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
} from '@remixicon/react'
import { toast } from 'sonner'

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
      await createRoom({ siteId, name: name.trim(), type })
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
            <div className="grid grid-cols-5 gap-1.5">
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
            <div className="grid grid-cols-5 gap-1.5">
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
  const [level, setLevel] = useState('')
  const [loading, setLoading] = useState(false)

  const suggestedLevel =
    floors.length > 0 ? Math.max(...floors.map((f) => f.level)) + 1 : 0

  useEffect(() => {
    if (!open) {
      setName('')
      setLevel('')
    }
  }, [open])

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('Please enter a floor name')
      return
    }
    const levelNum = level.trim() !== '' ? Number(level) : suggestedLevel
    if (isNaN(levelNum)) {
      toast.error('Level must be a number')
      return
    }
    setLoading(true)
    try {
      await createFloor({ siteId, name: name.trim(), level: levelNum })
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

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="floor-name">Floor Name</Label>
            <Input
              id="floor-name"
              placeholder="e.g. Second Floor, Basement"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="floor-level">Level Number</Label>
            <Input
              id="floor-level"
              type="number"
              placeholder={String(suggestedLevel)}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              Use 0 for ground, negative for basement levels
            </p>
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
