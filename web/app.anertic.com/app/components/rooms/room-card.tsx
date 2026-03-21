import { useState } from 'react'
import {
  RiMoreLine,
  RiAddLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
} from '@remixicon/react'

import { cn } from '~/lib/utils'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Skeleton } from '~/components/ui/skeleton'
import {
  ROOM_TYPE_CONFIG,
  ROOM_STATUS_CONFIG,
  type RoomItem,
  type RoomDeviceItem,
} from '~/lib/room'
import { formatPower, timeAgo, connectionStatusDot } from '~/lib/room-helpers'
import { useRoomDetail } from '~/hooks/use-rooms'

// --- Device Row ---

export function DeviceRow({ device }: { device: RoomDeviceItem }) {
  const dotClass = connectionStatusDot(device.connectionStatus)
  const statusCfg = ROOM_STATUS_CONFIG[device.connectionStatus]

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <div className="relative shrink-0">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted/80 text-[10px] font-semibold text-muted-foreground uppercase">
          {device.type.slice(0, 2)}
        </div>
        <span
          className={cn(
            'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background',
            dotClass
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{device.name}</p>
        <p className="text-[10px] text-muted-foreground capitalize">
          {device.type} · {timeAgo(device.lastSeenAt)}
        </p>
      </div>

      <Badge
        variant="outline"
        className={cn('shrink-0 text-[10px]', statusCfg.color)}
      >
        {statusCfg.label}
      </Badge>
    </div>
  )
}

// --- Expanded Device List (lazy-loaded via useRoomDetail) ---

function ExpandedDeviceList({
  roomId,
  onAssignDevice,
}: {
  roomId: string
  onAssignDevice: () => void
}) {
  const { data, isLoading } = useRoomDetail(roomId)

  return (
    <div className="border-t bg-muted/20">
      {isLoading ? (
        <div className="space-y-2 p-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="divide-y">
          {(data?.devices ?? []).map((device) => (
            <DeviceRow key={device.id} device={device} />
          ))}
          {!data?.devices?.length && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No devices assigned
            </p>
          )}
        </div>
      )}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={onAssignDevice}
        >
          <RiAddLine className="mr-1 size-3.5" />
          Assign Device
        </Button>
      </div>
    </div>
  )
}

// --- Room Card (Grid View) ---

export function RoomCard({
  room,
  onEdit,
  onDelete,
  onAssignDevice,
}: {
  room: RoomItem
  onEdit: (room: RoomItem) => void
  onDelete: (room: RoomItem) => void
  onAssignDevice: (room: RoomItem) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = ROOM_TYPE_CONFIG[room.type]
  const Icon = config.icon
  const statusCfg = ROOM_STATUS_CONFIG[room.connectionStatus]

  return (
    <Card
      className={cn(
        'group py-0 transition-all duration-200 hover:shadow-md',
        isExpanded && 'ring-1 ring-violet-500/30',
        room.connectionStatus === 'degraded' && 'border-amber-500/30',
        room.connectionStatus === 'offline' && 'border-red-500/30'
      )}
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                config.bg
              )}
            >
              <Icon className={cn('size-5', config.color)} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{room.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{room.deviceCount} devices</span>
                <span className="text-border">·</span>
                <span
                  className={cn('flex items-center gap-1', statusCfg.color)}
                >
                  <span
                    className={cn(
                      'inline-block size-1.5 rounded-full',
                      statusCfg.dot
                    )}
                  />
                  {statusCfg.label}
                </span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0 opacity-0 group-hover:opacity-100"
              >
                <RiMoreLine className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAssignDevice(room)}>
                <RiAddLine className="mr-2 size-4" />
                Assign Device
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(room)}>
                <RiEdit2Line className="mr-2 size-4" />
                Edit Room
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(room)}
              >
                <RiDeleteBinLine className="mr-2 size-4" />
                Delete Room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Live Power */}
        <div className="px-4 pb-4">
          <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
            Live Power
          </p>
          <p className="text-lg font-bold tabular-nums">
            {formatPower(room.livePowerW)}
          </p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {isExpanded ? (
            <>
              <RiArrowUpSLine className="size-3.5" />
              Hide devices
            </>
          ) : (
            <>
              <RiArrowDownSLine className="size-3.5" />
              {room.deviceCount} devices
            </>
          )}
        </button>

        {isExpanded && (
          <ExpandedDeviceList
            roomId={room.id}
            onAssignDevice={() => onAssignDevice(room)}
          />
        )}
      </CardContent>
    </Card>
  )
}

// --- Room List Item ---

export function RoomListItem({
  room,
  onEdit,
  onDelete,
  onAssignDevice,
}: {
  room: RoomItem
  onEdit: (room: RoomItem) => void
  onDelete: (room: RoomItem) => void
  onAssignDevice: (room: RoomItem) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = ROOM_TYPE_CONFIG[room.type]
  const Icon = config.icon
  const statusCfg = ROOM_STATUS_CONFIG[room.connectionStatus]

  return (
    <Card
      className={cn(
        'group py-0 transition-all',
        isExpanded && 'ring-1 ring-violet-500/30'
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-2 pr-2">
          <button
            className="flex flex-1 items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
            onClick={() => setIsExpanded((v) => !v)}
          >
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                config.bg
              )}
            >
              <Icon className={cn('size-4', config.color)} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{room.name}</h3>
                {room.connectionStatus !== 'online' && (
                  <Badge
                    variant="outline"
                    className={cn('px-1.5 py-0 text-[10px]', statusCfg.color)}
                  >
                    {statusCfg.label}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {room.deviceCount} devices · {config.label}
              </p>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatPower(room.livePowerW)}
                </p>
                <p className="text-[10px] text-muted-foreground">live</p>
              </div>
              <RiArrowRightSLine
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  isExpanded && 'rotate-90'
                )}
              />
            </div>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 shrink-0 p-0 opacity-0 group-hover:opacity-100"
              >
                <RiMoreLine className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAssignDevice(room)}>
                <RiAddLine className="mr-2 size-4" />
                Assign Device
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(room)}>
                <RiEdit2Line className="mr-2 size-4" />
                Edit Room
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(room)}
              >
                <RiDeleteBinLine className="mr-2 size-4" />
                Delete Room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isExpanded && (
          <ExpandedDeviceList
            roomId={room.id}
            onAssignDevice={() => onAssignDevice(room)}
          />
        )}
      </CardContent>
    </Card>
  )
}
