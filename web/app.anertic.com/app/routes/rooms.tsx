import { useEffect, useState } from "react"
import {
  RiAddLine,
  RiSearchLine,
  RiPlugLine,
  RiComputerLine,
  RiPrinterLine,
  RiBattery2ChargeLine,
  RiLightbulbLine,
  RiTempColdLine,
  RiWifiLine,
  RiSensorLine,
  RiHome2Line,
  RiBuilding2Line,
  RiArrowRightSLine,
  RiFlashlightLine,
  RiDoorOpenLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiMoreLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiLayoutGridLine,
  RiListCheck2,
  RiCloseLine,
  RiCheckLine,
  RiDragMoveLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { useSiteId } from "~/layouts/site"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { cn } from "~/lib/utils"

// --- Types ---

interface Floor {
  id: string
  name: string
  level: number
  rooms: Room[]
}

interface Room {
  id: string
  floorId: string
  name: string
  type: RoomType
  devices: Device[]
  totalPowerW: number
  todayEnergyKwh: number
  yesterdayEnergyKwh: number
  status: "normal" | "warning" | "critical"
  tempC?: number
  humidity?: number
}

type RoomType =
  | "living"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "office"
  | "garage"
  | "laundry"
  | "storage"
  | "outdoor"
  | "other"

interface Device {
  id: string
  name: string
  type: DeviceType
  status: "online" | "offline" | "standby"
  powerW: number
  todayKwh: number
  lastSeen: string
}

type DeviceType =
  | "plug"
  | "computer"
  | "printer"
  | "battery"
  | "light"
  | "aircon"
  | "sensor"
  | "router"
  | "other"

// --- Helpers ---

function deviceIcon(type: DeviceType) {
  switch (type) {
    case "plug":
      return RiPlugLine
    case "computer":
      return RiComputerLine
    case "printer":
      return RiPrinterLine
    case "battery":
      return RiBattery2ChargeLine
    case "light":
      return RiLightbulbLine
    case "aircon":
      return RiTempColdLine
    case "sensor":
      return RiSensorLine
    case "router":
      return RiWifiLine
    default:
      return RiPlugLine
  }
}

function deviceStatusColor(status: Device["status"]) {
  switch (status) {
    case "online":
      return "bg-emerald-500"
    case "standby":
      return "bg-amber-500"
    case "offline":
      return "bg-gray-400"
  }
}

function deviceStatusBadge(status: Device["status"]) {
  switch (status) {
    case "online":
      return "bg-emerald-500/15 text-emerald-700"
    case "standby":
      return "bg-amber-500/15 text-amber-700"
    case "offline":
      return "bg-gray-500/15 text-gray-600"
  }
}

function roomIcon(type: RoomType) {
  switch (type) {
    case "garage":
    case "outdoor":
      return RiBuilding2Line
    default:
      return RiHome2Line
  }
}

function formatPower(watts: number): string {
  if (watts >= 1000) return `${(watts / 1000).toFixed(1)} kW`
  return `${Math.round(watts)} W`
}

function formatEnergy(kwh: number): string {
  if (kwh >= 100) return `${Math.round(kwh)} kWh`
  return `${kwh.toFixed(1)} kWh`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function energyTrend(today: number, yesterday: number): { direction: "up" | "down" | "stable"; percent: number } {
  if (yesterday === 0) return { direction: "stable", percent: 0 }
  const change = ((today - yesterday) / yesterday) * 100
  if (Math.abs(change) < 2) return { direction: "stable", percent: 0 }
  return { direction: change > 0 ? "up" : "down", percent: Math.abs(Math.round(change)) }
}

// --- Mock Data ---

function generateMockFloors(): Floor[] {
  const now = Date.now()
  return [
    {
      id: "f-1",
      name: "Ground Floor",
      level: 0,
      rooms: [
        {
          id: "r-1",
          floorId: "f-1",
          name: "Living Room",
          type: "living",
          totalPowerW: 342,
          todayEnergyKwh: 4.8,
          yesterdayEnergyKwh: 5.2,
          status: "normal",
          tempC: 25,
          humidity: 62,
          devices: [
            { id: "d-1", name: "Smart TV", type: "plug", status: "online", powerW: 120, todayKwh: 1.8, lastSeen: new Date(now - 5000).toISOString() },
            { id: "d-2", name: "Floor Lamp", type: "light", status: "online", powerW: 12, todayKwh: 0.3, lastSeen: new Date(now - 8000).toISOString() },
            { id: "d-3", name: "Air Conditioner", type: "aircon", status: "online", powerW: 180, todayKwh: 2.4, lastSeen: new Date(now - 3000).toISOString() },
            { id: "d-4", name: "Wi-Fi Router", type: "router", status: "online", powerW: 18, todayKwh: 0.2, lastSeen: new Date(now - 2000).toISOString() },
            { id: "d-5", name: "Desk Lamp", type: "light", status: "standby", powerW: 0, todayKwh: 0.1, lastSeen: new Date(now - 120000).toISOString() },
            { id: "d-14", name: "Temperature Sensor", type: "sensor", status: "online", powerW: 2, todayKwh: 0.0, lastSeen: new Date(now - 15000).toISOString() },
          ],
        },
        {
          id: "r-2",
          floorId: "f-1",
          name: "Kitchen",
          type: "kitchen",
          totalPowerW: 1820,
          todayEnergyKwh: 8.3,
          yesterdayEnergyKwh: 7.1,
          status: "warning",
          tempC: 28,
          humidity: 55,
          devices: [
            { id: "d-6", name: "Refrigerator", type: "plug", status: "online", powerW: 150, todayKwh: 3.6, lastSeen: new Date(now - 10000).toISOString() },
            { id: "d-7", name: "Microwave", type: "plug", status: "online", powerW: 1200, todayKwh: 1.2, lastSeen: new Date(now - 60000).toISOString() },
            { id: "d-8", name: "Dishwasher", type: "plug", status: "online", powerW: 450, todayKwh: 3.2, lastSeen: new Date(now - 30000).toISOString() },
            { id: "d-15", name: "Kitchen Light", type: "light", status: "online", powerW: 20, todayKwh: 0.3, lastSeen: new Date(now - 5000).toISOString() },
          ],
        },
        {
          id: "r-3",
          floorId: "f-1",
          name: "Garage",
          type: "garage",
          totalPowerW: 45,
          todayEnergyKwh: 12.6,
          yesterdayEnergyKwh: 11.8,
          status: "normal",
          devices: [
            { id: "d-9", name: "Home Battery", type: "battery", status: "online", powerW: 0, todayKwh: 8.2, lastSeen: new Date(now - 12000).toISOString() },
            { id: "d-10", name: "Security Camera", type: "sensor", status: "online", powerW: 8, todayKwh: 0.2, lastSeen: new Date(now - 4000).toISOString() },
            { id: "d-16", name: "Garage Door Sensor", type: "sensor", status: "online", powerW: 2, todayKwh: 0.0, lastSeen: new Date(now - 60000).toISOString() },
            { id: "d-17", name: "Workshop Light", type: "light", status: "offline", powerW: 0, todayKwh: 0.0, lastSeen: new Date(now - 86400000).toISOString() },
            { id: "d-18", name: "Garage Plug", type: "plug", status: "standby", powerW: 35, todayKwh: 4.2, lastSeen: new Date(now - 300000).toISOString() },
          ],
        },
      ],
    },
    {
      id: "f-2",
      name: "First Floor",
      level: 1,
      rooms: [
        {
          id: "r-4",
          floorId: "f-2",
          name: "Master Bedroom",
          type: "bedroom",
          totalPowerW: 65,
          todayEnergyKwh: 1.9,
          yesterdayEnergyKwh: 2.3,
          status: "normal",
          tempC: 24,
          humidity: 58,
          devices: [
            { id: "d-11", name: "Bedside Lamp", type: "light", status: "standby", powerW: 0, todayKwh: 0.1, lastSeen: new Date(now - 7200000).toISOString() },
            { id: "d-19", name: "Air Purifier", type: "plug", status: "online", powerW: 45, todayKwh: 1.1, lastSeen: new Date(now - 10000).toISOString() },
            { id: "d-20", name: "Ceiling Fan", type: "plug", status: "online", powerW: 20, todayKwh: 0.5, lastSeen: new Date(now - 8000).toISOString() },
            { id: "d-21", name: "Motion Sensor", type: "sensor", status: "online", powerW: 0, todayKwh: 0.0, lastSeen: new Date(now - 30000).toISOString() },
          ],
        },
        {
          id: "r-5",
          floorId: "f-2",
          name: "Home Office",
          type: "office",
          totalPowerW: 385,
          todayEnergyKwh: 3.4,
          yesterdayEnergyKwh: 3.6,
          status: "normal",
          tempC: 26,
          devices: [
            { id: "d-12", name: "Desktop PC", type: "computer", status: "online", powerW: 280, todayKwh: 2.2, lastSeen: new Date(now - 2000).toISOString() },
            { id: "d-13", name: "Laser Printer", type: "printer", status: "standby", powerW: 5, todayKwh: 0.3, lastSeen: new Date(now - 600000).toISOString() },
            { id: "d-22", name: "Monitor", type: "plug", status: "online", powerW: 45, todayKwh: 0.6, lastSeen: new Date(now - 5000).toISOString() },
            { id: "d-23", name: "Desk Lamp", type: "light", status: "online", powerW: 12, todayKwh: 0.1, lastSeen: new Date(now - 8000).toISOString() },
            { id: "d-24", name: "USB Hub", type: "plug", status: "online", powerW: 25, todayKwh: 0.1, lastSeen: new Date(now - 3000).toISOString() },
            { id: "d-25", name: "Speaker", type: "plug", status: "online", powerW: 18, todayKwh: 0.1, lastSeen: new Date(now - 12000).toISOString() },
          ],
        },
        {
          id: "r-6",
          floorId: "f-2",
          name: "Bathroom",
          type: "bathroom",
          totalPowerW: 0,
          todayEnergyKwh: 0.8,
          yesterdayEnergyKwh: 0.7,
          status: "normal",
          tempC: 27,
          humidity: 78,
          devices: [
            { id: "d-26", name: "Water Heater", type: "plug", status: "standby", powerW: 0, todayKwh: 0.6, lastSeen: new Date(now - 3600000).toISOString() },
            { id: "d-27", name: "Exhaust Fan", type: "plug", status: "offline", powerW: 0, todayKwh: 0.2, lastSeen: new Date(now - 7200000).toISOString() },
          ],
        },
        {
          id: "r-7",
          floorId: "f-2",
          name: "Guest Room",
          type: "bedroom",
          totalPowerW: 8,
          todayEnergyKwh: 0.2,
          yesterdayEnergyKwh: 0.1,
          status: "normal",
          devices: [
            { id: "d-28", name: "Smart Plug", type: "plug", status: "standby", powerW: 3, todayKwh: 0.1, lastSeen: new Date(now - 1800000).toISOString() },
            { id: "d-29", name: "Temp Sensor", type: "sensor", status: "online", powerW: 1, todayKwh: 0.0, lastSeen: new Date(now - 20000).toISOString() },
          ],
        },
      ],
    },
    {
      id: "f-3",
      name: "Rooftop",
      level: 2,
      rooms: [
        {
          id: "r-8",
          floorId: "f-3",
          name: "Solar & Utility",
          type: "outdoor",
          totalPowerW: 22,
          todayEnergyKwh: 0.5,
          yesterdayEnergyKwh: 0.4,
          status: "normal",
          devices: [
            { id: "d-30", name: "Inverter Monitor", type: "sensor", status: "online", powerW: 12, todayKwh: 0.3, lastSeen: new Date(now - 5000).toISOString() },
            { id: "d-31", name: "Weather Station", type: "sensor", status: "online", powerW: 5, todayKwh: 0.1, lastSeen: new Date(now - 15000).toISOString() },
            { id: "d-32", name: "Antenna Amplifier", type: "plug", status: "online", powerW: 5, todayKwh: 0.1, lastSeen: new Date(now - 30000).toISOString() },
          ],
        },
      ],
    },
  ]
}

// --- Floor Summary ---

function getFloorSummary(floor: Floor) {
  const totalDevices = floor.rooms.reduce((s, r) => s + r.devices.length, 0)
  const onlineDevices = floor.rooms.reduce(
    (s, r) => s + r.devices.filter((d) => d.status === "online").length,
    0,
  )
  const totalPowerW = floor.rooms.reduce((s, r) => s + r.totalPowerW, 0)
  const todayKwh = floor.rooms.reduce((s, r) => s + r.todayEnergyKwh, 0)
  return { totalDevices, onlineDevices, totalPowerW, todayKwh }
}

// --- Room Status Bar (mini power distribution) ---

function RoomPowerBar({ devices }: { devices: Device[] }) {
  const totalPower = devices.reduce((s, d) => s + d.powerW, 0)
  if (totalPower === 0) return null

  const segments = devices
    .filter((d) => d.powerW > 0)
    .sort((a, b) => b.powerW - a.powerW)
    .slice(0, 5)

  const colors = [
    "bg-violet-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
  ]

  return (
    <div className="flex gap-0.5 overflow-hidden rounded-full h-1.5">
      {segments.map((device, i) => (
        <div
          key={device.id}
          className={cn("h-full rounded-full", colors[i])}
          style={{ width: `${(device.powerW / totalPower) * 100}%`, minWidth: "4px" }}
        />
      ))}
    </div>
  )
}

// --- Main Component ---

export default function Rooms() {
  const siteId = useSiteId()
  const [mounted, setMounted] = useState(false)
  const [floors, setFloors] = useState<Floor[]>(() => generateMockFloors())
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null)
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Dialogs
  const [addRoomOpen, setAddRoomOpen] = useState(false)
  const [addFloorOpen, setAddFloorOpen] = useState(false)
  const [assignDeviceOpen, setAssignDeviceOpen] = useState(false)
  const [assignToRoomId, setAssignToRoomId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (floors.length > 0 && !activeFloorId) {
      setActiveFloorId(floors[0].id)
    }
  }, [floors, activeFloorId])

  const activeFloor = floors.find((f) => f.id === activeFloorId) || floors[0]

  // Search across all rooms and devices
  const filteredRooms = activeFloor?.rooms.filter((room) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      room.name.toLowerCase().includes(q) ||
      room.devices.some((d) => d.name.toLowerCase().includes(q))
    )
  }) || []

  // Site-wide aggregates
  const allRooms = floors.flatMap((f) => f.rooms)
  const allDevices = allRooms.flatMap((r) => r.devices)
  const totalSitePowerW = allRooms.reduce((s, r) => s + r.totalPowerW, 0)
  const totalSiteTodayKwh = allRooms.reduce((s, r) => s + r.todayEnergyKwh, 0)
  const onlineDeviceCount = allDevices.filter((d) => d.status === "online").length
  const warningRooms = allRooms.filter((r) => r.status === "warning" || r.status === "critical")

  return (
    <div
      className={cn(
        "space-y-6 transition-opacity duration-500",
        mounted ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
          <p className="text-sm text-muted-foreground">
            Organize devices by floor and room to monitor energy usage spatially
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddFloorOpen(true)}
          >
            <RiBuilding2Line className="mr-1.5 size-4" />
            Add Floor
          </Button>
          <Button
            size="sm"
            onClick={() => setAddRoomOpen(true)}
          >
            <RiAddLine className="mr-1.5 size-4" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Site-wide Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
              <RiFlashlightLine className="size-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Live Power</p>
              <p className="text-lg font-semibold tabular-nums">{formatPower(totalSitePowerW)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
              <RiPlugLine className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Today Energy</p>
              <p className="text-lg font-semibold tabular-nums">{formatEnergy(totalSiteTodayKwh)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <RiSensorLine className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Devices Online</p>
              <p className="text-lg font-semibold tabular-nums">
                {onlineDeviceCount}
                <span className="text-sm font-normal text-muted-foreground">/{allDevices.length}</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <RiDoorOpenLine className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Rooms</p>
              <p className="text-lg font-semibold tabular-nums">
                {allRooms.length}
                <span className="text-sm font-normal text-muted-foreground"> across {floors.length} floors</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floor Tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Floor selector */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
          {floors.map((floor) => {
            const summary = getFloorSummary(floor)
            const isActive = floor.id === activeFloorId
            return (
              <button
                key={floor.id}
                onClick={() => {
                  setActiveFloorId(floor.id)
                  setExpandedRoomId(null)
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{floor.name}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    isActive ? "bg-violet-500/15 text-violet-700" : "bg-muted text-muted-foreground",
                  )}
                >
                  {summary.totalDevices}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <RiSearchLine className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search rooms or devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[220px] pl-8 text-sm"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-md border p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RiLayoutGridLine className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded p-1 transition-colors",
                viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <RiListCheck2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floor Summary Bar */}
      {activeFloor && (
        <div className="flex items-center gap-6 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <RiBuilding2Line className="size-4" />
            <span className="font-medium text-foreground">{activeFloor.name}</span>
            <span className="text-xs">(Level {activeFloor.level})</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{formatPower(getFloorSummary(activeFloor).totalPowerW)}</strong> live
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">{formatEnergy(getFloorSummary(activeFloor).todayKwh)}</strong> today
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">{activeFloor.rooms.length}</strong> rooms
            </span>
          </div>
        </div>
      )}

      {/* Rooms Grid/List */}
      {filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <RiDoorOpenLine className="size-12 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            {searchQuery ? "No rooms match your search" : "No rooms on this floor"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {searchQuery ? "Try a different search term" : "Add a room to start organizing devices"}
          </p>
          {!searchQuery && (
            <Button size="sm" className="mt-4" onClick={() => setAddRoomOpen(true)}>
              <RiAddLine className="mr-1.5 size-4" />
              Add Room
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              isExpanded={expandedRoomId === room.id}
              onToggle={() => setExpandedRoomId(expandedRoomId === room.id ? null : room.id)}
              onAssignDevice={() => {
                setAssignToRoomId(room.id)
                setAssignDeviceOpen(true)
              }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRooms.map((room) => (
            <RoomListItem
              key={room.id}
              room={room}
              isExpanded={expandedRoomId === room.id}
              onToggle={() => setExpandedRoomId(expandedRoomId === room.id ? null : room.id)}
              onAssignDevice={() => {
                setAssignToRoomId(room.id)
                setAssignDeviceOpen(true)
              }}
            />
          ))}
        </div>
      )}

      {/* Add Room Dialog */}
      <AddRoomDialog
        open={addRoomOpen}
        onOpenChange={setAddRoomOpen}
        floors={floors}
        activeFloorId={activeFloorId}
      />

      {/* Add Floor Dialog */}
      <AddFloorDialog
        open={addFloorOpen}
        onOpenChange={setAddFloorOpen}
        existingFloors={floors}
      />

      {/* Assign Device Dialog */}
      <AssignDeviceDialog
        open={assignDeviceOpen}
        onOpenChange={setAssignDeviceOpen}
        roomId={assignToRoomId}
        rooms={allRooms}
      />
    </div>
  )
}

// --- Room Card (Grid View) ---

function RoomCard({
  room,
  isExpanded,
  onToggle,
  onAssignDevice,
}: {
  room: Room
  isExpanded: boolean
  onToggle: () => void
  onAssignDevice: () => void
}) {
  const onlineCount = room.devices.filter((d) => d.status === "online").length
  const trend = energyTrend(room.todayEnergyKwh, room.yesterdayEnergyKwh)
  const Icon = roomIcon(room.type)
  const topConsumer = [...room.devices].sort((a, b) => b.powerW - a.powerW)[0]

  return (
    <Card
      className={cn(
        "group transition-all duration-200 hover:shadow-md",
        isExpanded && "ring-1 ring-violet-500/30",
        room.status === "warning" && "border-amber-500/30",
        room.status === "critical" && "border-red-500/30",
      )}
    >
      <CardContent className="p-0">
        {/* Room Header */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                room.status === "warning"
                  ? "bg-amber-500/10"
                  : room.status === "critical"
                    ? "bg-red-500/10"
                    : "bg-violet-500/10",
              )}
            >
              <Icon
                className={cn(
                  "size-5",
                  room.status === "warning"
                    ? "text-amber-600"
                    : room.status === "critical"
                      ? "text-red-600"
                      : "text-violet-600",
                )}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{room.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{onlineCount}/{room.devices.length} online</span>
                {room.tempC !== undefined && (
                  <>
                    <span className="text-border">·</span>
                    <span>{room.tempC}°C</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-7 p-0 opacity-0 group-hover:opacity-100">
                <RiMoreLine className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onAssignDevice}>
                <RiAddLine className="mr-2 size-4" />
                Assign Device
              </DropdownMenuItem>
              <DropdownMenuItem>
                <RiEdit2Line className="mr-2 size-4" />
                Edit Room
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <RiDeleteBinLine className="mr-2 size-4" />
                Delete Room
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Power & Energy */}
        <div className="grid grid-cols-2 gap-3 px-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live Power</p>
            <p className="text-lg font-bold tabular-nums">{formatPower(room.totalPowerW)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</p>
            <div className="flex items-center gap-1.5">
              <p className="text-lg font-bold tabular-nums">{formatEnergy(room.todayEnergyKwh)}</p>
              {trend.direction !== "stable" && (
                <span
                  className={cn(
                    "flex items-center text-[10px] font-medium",
                    trend.direction === "up" ? "text-red-500" : "text-emerald-500",
                  )}
                >
                  {trend.direction === "up" ? (
                    <RiArrowUpSLine className="size-3" />
                  ) : (
                    <RiArrowDownSLine className="size-3" />
                  )}
                  {trend.percent}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Power Distribution Bar */}
        <div className="px-4 pt-3">
          <RoomPowerBar devices={room.devices} />
          {topConsumer && topConsumer.powerW > 0 && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Top: <span className="font-medium text-foreground">{topConsumer.name}</span>{" "}
              ({formatPower(topConsumer.powerW)})
            </p>
          )}
        </div>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={onToggle}
          className="mt-3 flex w-full items-center justify-center gap-1 border-t py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {isExpanded ? (
            <>
              <RiArrowUpSLine className="size-3.5" />
              Hide devices
            </>
          ) : (
            <>
              <RiArrowDownSLine className="size-3.5" />
              {room.devices.length} devices
            </>
          )}
        </button>

        {/* Expanded Device List */}
        {isExpanded && (
          <div className="border-t bg-muted/20">
            <div className="divide-y">
              {room.devices.map((device) => (
                <DeviceRow key={device.id} device={device} />
              ))}
            </div>
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
        )}
      </CardContent>
    </Card>
  )
}

// --- Room List Item ---

function RoomListItem({
  room,
  isExpanded,
  onToggle,
  onAssignDevice,
}: {
  room: Room
  isExpanded: boolean
  onToggle: () => void
  onAssignDevice: () => void
}) {
  const onlineCount = room.devices.filter((d) => d.status === "online").length
  const trend = energyTrend(room.todayEnergyKwh, room.yesterdayEnergyKwh)
  const Icon = roomIcon(room.type)

  return (
    <Card className={cn("transition-all", isExpanded && "ring-1 ring-violet-500/30")}>
      <CardContent className="p-0">
        <button
          onClick={onToggle}
          className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
        >
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              room.status === "warning" ? "bg-amber-500/10" : "bg-violet-500/10",
            )}
          >
            <Icon className={cn("size-4", room.status === "warning" ? "text-amber-600" : "text-violet-600")} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{room.name}</h3>
              {room.status === "warning" && (
                <Badge className="bg-amber-500/15 text-amber-700 text-[10px] px-1.5 py-0">High usage</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {onlineCount}/{room.devices.length} devices online
              {room.tempC !== undefined && <> · {room.tempC}°C</>}
            </p>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-sm font-semibold tabular-nums">{formatPower(room.totalPowerW)}</p>
              <p className="text-[10px] text-muted-foreground">live</p>
            </div>
            <div>
              <div className="flex items-center justify-end gap-1">
                <p className="text-sm font-semibold tabular-nums">{formatEnergy(room.todayEnergyKwh)}</p>
                {trend.direction !== "stable" && (
                  <span className={cn("text-[10px]", trend.direction === "up" ? "text-red-500" : "text-emerald-500")}>
                    {trend.direction === "up" ? "↑" : "↓"}{trend.percent}%
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">today</p>
            </div>
            <div className="w-24">
              <RoomPowerBar devices={room.devices} />
            </div>
            <RiArrowRightSLine
              className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")}
            />
          </div>
        </button>

        {isExpanded && (
          <div className="border-t bg-muted/20">
            <div className="divide-y">
              {room.devices.map((device) => (
                <DeviceRow key={device.id} device={device} />
              ))}
            </div>
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
        )}
      </CardContent>
    </Card>
  )
}

// --- Device Row ---

function DeviceRow({ device }: { device: Device }) {
  const Icon = deviceIcon(device.type)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <div className="relative">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted/80">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background",
            deviceStatusColor(device.status),
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{device.name}</p>
        <p className="text-[10px] text-muted-foreground capitalize">{device.type} · {timeAgo(device.lastSeen)}</p>
      </div>

      <div className="flex items-center gap-4 text-right">
        <div>
          <p className="text-sm font-medium tabular-nums">
            {device.status === "offline" ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              formatPower(device.powerW)
            )}
          </p>
        </div>
        <div className="w-14">
          <p className="text-xs tabular-nums text-muted-foreground">{device.todayKwh.toFixed(1)} kWh</p>
        </div>
        <Badge className={cn("text-[10px] px-1.5 py-0", deviceStatusBadge(device.status))}>
          {device.status}
        </Badge>
      </div>
    </div>
  )
}

// --- Add Room Dialog ---

function AddRoomDialog({
  open,
  onOpenChange,
  floors,
  activeFloorId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  floors: Floor[]
  activeFloorId: string | null
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<RoomType>("living")
  const [floorId, setFloorId] = useState(activeFloorId || "")

  useEffect(() => {
    if (open && activeFloorId) setFloorId(activeFloorId)
  }, [open, activeFloorId])

  const roomTypes: { value: RoomType; label: string }[] = [
    { value: "living", label: "Living Room" },
    { value: "bedroom", label: "Bedroom" },
    { value: "kitchen", label: "Kitchen" },
    { value: "bathroom", label: "Bathroom" },
    { value: "office", label: "Office" },
    { value: "garage", label: "Garage" },
    { value: "laundry", label: "Laundry" },
    { value: "storage", label: "Storage" },
    { value: "outdoor", label: "Outdoor" },
    { value: "other", label: "Other" },
  ]

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Please enter a room name")
      return
    }
    toast.success(`Room "${name}" created`)
    setName("")
    setType("living")
    onOpenChange(false)
  }

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
            <Label htmlFor="room-name">Room Name</Label>
            <Input
              id="room-name"
              placeholder="e.g. Living Room, Home Office"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="room-floor">Floor</Label>
            <select
              id="room-floor"
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Room Type</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {roomTypes.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setType(rt.value)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
                    type === rt.value
                      ? "border-violet-500 bg-violet-500/10 text-violet-700"
                      : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <RiCheckLine className="mr-1.5 size-4" />
            Create Room
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Add Floor Dialog ---

function AddFloorDialog({
  open,
  onOpenChange,
  existingFloors,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingFloors: Floor[]
}) {
  const [name, setName] = useState("")
  const [level, setLevel] = useState("")

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Please enter a floor name")
      return
    }
    toast.success(`Floor "${name}" created`)
    setName("")
    setLevel("")
    onOpenChange(false)
  }

  const suggestedLevel = existingFloors.length > 0
    ? Math.max(...existingFloors.map((f) => f.level)) + 1
    : 0

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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <RiCheckLine className="mr-1.5 size-4" />
            Create Floor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Assign Device Dialog ---

function AssignDeviceDialog({
  open,
  onOpenChange,
  roomId,
  rooms,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string | null
  rooms: Room[]
}) {
  const [search, setSearch] = useState("")
  const room = rooms.find((r) => r.id === roomId)

  // Mock unassigned devices
  const unassignedDevices: Device[] = [
    { id: "u-1", name: "Smart Plug #5", type: "plug", status: "online", powerW: 0, todayKwh: 0, lastSeen: new Date().toISOString() },
    { id: "u-2", name: "Energy Monitor", type: "sensor", status: "online", powerW: 2, todayKwh: 0.1, lastSeen: new Date().toISOString() },
    { id: "u-3", name: "LED Strip", type: "light", status: "offline", powerW: 0, todayKwh: 0, lastSeen: new Date(Date.now() - 86400000).toISOString() },
    { id: "u-4", name: "UPS Battery", type: "battery", status: "online", powerW: 0, todayKwh: 0.4, lastSeen: new Date().toISOString() },
    { id: "u-5", name: "Mini PC", type: "computer", status: "standby", powerW: 5, todayKwh: 0.2, lastSeen: new Date().toISOString() },
  ]

  const filtered = unassignedDevices.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()),
  )

  function handleAssign(deviceId: string) {
    const device = unassignedDevices.find((d) => d.id === deviceId)
    toast.success(`${device?.name} assigned to ${room?.name}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Device to {room?.name || "Room"}</DialogTitle>
          <DialogDescription>
            Select an unassigned device to place in this room.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <RiSearchLine className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="max-h-64 overflow-y-auto -mx-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No unassigned devices found</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((device) => {
                const Icon = deviceIcon(device.type)
                return (
                  <button
                    key={device.id}
                    onClick={() => handleAssign(device.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/80"
                  >
                    <div className="relative">
                      <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 size-2 rounded-full border-2 border-background",
                          deviceStatusColor(device.status),
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{device.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{device.type} · {device.status}</p>
                    </div>
                    <RiAddLine className="size-4 text-muted-foreground" />
                  </button>
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
