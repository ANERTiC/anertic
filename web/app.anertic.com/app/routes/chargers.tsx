import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import {
  RiAddLine,
  RiChargingPileLine,
  RiSearchLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
} from "@remixicon/react"
import { toast } from "sonner"
import useSWR from "swr"

import { api } from "~/lib/api"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Skeleton } from "~/components/ui/skeleton"
import { Badge } from "~/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"

interface Charger {
  id: string
  siteId: string
  chargePointId: string
  ocppVersion: string
  status: string
  registrationStatus: string
  connectorCount: number
  maxPowerKw: number
  vendor: string
  model: string
  serialNumber: string
  firmwareVersion: string
  lastHeartbeatAt: string | null
  createdAt: string
}

interface ListResult {
  items: Charger[]
}

interface CreateResult {
  id: string
}

function statusColor(status: string) {
  switch (status) {
    case "Available":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    case "Charging":
    case "Preparing":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400"
    case "SuspendedEV":
    case "SuspendedEVSE":
    case "Finishing":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    case "Faulted":
      return "bg-red-500/15 text-red-700 dark:text-red-400"
    case "Reserved":
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400"
    default:
      return "bg-gray-500/15 text-gray-700 dark:text-gray-400"
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Chargers() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const siteId = searchParams.get("site")!
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [chargePointId, setChargePointId] = useState("")
  const [ocppVersion, setOcppVersion] = useState("1.6")
  const [connectorCount, setConnectorCount] = useState("1")
  const [maxPowerKw, setMaxPowerKw] = useState("")

  const { data, isLoading, mutate } = useSWR(
    siteId ? ["charger.list", siteId] : null,
    () => api<ListResult>("charger.list", { siteId }),
  )

  const chargers = (data?.items || []).filter(
    (c) =>
      !search ||
      c.chargePointId.toLowerCase().includes(search.toLowerCase()) ||
      c.vendor.toLowerCase().includes(search.toLowerCase()) ||
      c.model.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const result = await api<CreateResult>("charger.create", {
        siteId,
        chargePointId,
        ocppVersion,
        connectorCount: parseInt(connectorCount) || 1,
        maxPowerKw: parseFloat(maxPowerKw) || 0,
      })
      toast.success("Charger registered successfully")
      setOpen(false)
      setChargePointId("")
      setOcppVersion("1.6")
      setConnectorCount("1")
      setMaxPowerKw("")
      mutate()
      navigate(`/chargers/${result.id}?site=${siteId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register charger")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chargers</h1>
          <p className="text-sm text-muted-foreground">
            EV charger management and status
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <RiAddLine className="mr-2 h-4 w-4" />
              Register Charger
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Register Charger</DialogTitle>
                <DialogDescription>
                  Add a new EV charger to this site.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="chargePointId">Charge Point ID</Label>
                  <Input
                    id="chargePointId"
                    placeholder="CP001"
                    value={chargePointId}
                    onChange={(e) => setChargePointId(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ocppVersion">OCPP Version</Label>
                    <select
                      id="ocppVersion"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={ocppVersion}
                      onChange={(e) => setOcppVersion(e.target.value)}
                    >
                      <option value="1.6">1.6</option>
                      <option value="2.0.1">2.0.1</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="connectorCount">Connectors</Label>
                    <Input
                      id="connectorCount"
                      type="number"
                      min="1"
                      value={connectorCount}
                      onChange={(e) => setConnectorCount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxPowerKw">Max Power (kW)</Label>
                  <Input
                    id="maxPowerKw"
                    type="number"
                    step="0.01"
                    placeholder="22"
                    value={maxPowerKw}
                    onChange={(e) => setMaxPowerKw(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? "Registering..." : "Register"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <RiSearchLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by charge point ID, vendor, or model..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : chargers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <RiChargingPileLine className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search
              ? "No chargers found"
              : "No chargers registered. Register your first charger to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chargers.map((charger) => (
            <Card
              key={charger.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => navigate(`/chargers/${charger.id}?site=${siteId}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{charger.chargePointId}</h3>
                    {(charger.vendor || charger.model) && (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {[charger.vendor, charger.model].filter(Boolean).join(" ")}
                      </p>
                    )}
                  </div>
                  <Badge className={statusColor(charger.status)}>
                    {charger.status}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{charger.connectorCount} connector{charger.connectorCount !== 1 ? "s" : ""}</span>
                  {charger.maxPowerKw > 0 && (
                    <>
                      <span>·</span>
                      <span>{charger.maxPowerKw} kW</span>
                    </>
                  )}
                  <span>·</span>
                  <span>OCPP {charger.ocppVersion}</span>
                </div>

                <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {charger.lastHeartbeatAt ? (
                      <RiSignalWifiLine className="h-3 w-3" />
                    ) : (
                      <RiSignalWifiOffLine className="h-3 w-3" />
                    )}
                    {timeAgo(charger.lastHeartbeatAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
