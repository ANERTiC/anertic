import { useNavigate, useParams } from "react-router"
import {
  RiArrowLeftLine,
  RiFlashlightLine,
  RiPlugLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
} from "@remixicon/react"
import { toast } from "sonner"
import useSWR from "swr"

import { api } from "~/lib/api"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

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
  chargeBoxSerialNumber: string
  firmwareStatus: string
  diagnosticsStatus: string
  heartbeatInterval: number
  lastHeartbeatAt: string | null
  createdAt: string
}

interface Connector {
  id: string
  chargerId: string
  connectorId: number
  status: string
  errorCode: string
  connectorType: string
  maxPowerKw: number
  info: string
  lastStatusAt: string | null
}

interface ConnectorListResult {
  items: Connector[]
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

function registrationColor(status: string) {
  switch (status) {
    case "Accepted":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
    case "Pending":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    case "Rejected":
      return "bg-red-500/15 text-red-700 dark:text-red-400"
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

export default function ChargerDetail() {
  const { chargerId } = useParams()
  const navigate = useNavigate()

  const { data: charger, isLoading } = useSWR(
    chargerId ? ["charger.get", chargerId] : null,
    () => api<Charger>("charger.get", { id: chargerId }),
    {
      onError(err) {
        toast.error(err instanceof Error ? err.message : "Failed to load charger")
      },
    },
  )

  // TODO: add connector.list API endpoint
  // const { data: connectors } = useSWR(...)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (!charger) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/chargers")}>
          <RiArrowLeftLine className="mr-2 h-4 w-4" />
          Back to Chargers
        </Button>
        <p className="text-sm text-muted-foreground">Charger not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => navigate("/chargers")}
          >
            <RiArrowLeftLine className="mr-1 h-4 w-4" />
            Chargers
          </Button>
          <h1 className="text-2xl font-semibold">{charger.chargePointId}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge className={statusColor(charger.status)}>
              {charger.status}
            </Badge>
            <Badge className={registrationColor(charger.registrationStatus)}>
              {charger.registrationStatus}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {charger.lastHeartbeatAt ? (
                <RiSignalWifiLine className="h-3 w-3" />
              ) : (
                <RiSignalWifiOffLine className="h-3 w-3" />
              )}
              {timeAgo(charger.lastHeartbeatAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InfoCard label="Vendor" value={charger.vendor || "—"} />
        <InfoCard label="Model" value={charger.model || "—"} />
        <InfoCard label="Serial Number" value={charger.serialNumber || "—"} />
        <InfoCard label="Firmware" value={charger.firmwareVersion || "—"} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="connectors">
        <TabsList>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="connectors" className="mt-4">
          <ConnectorsTab charger={charger} />
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
            <RiFlashlightLine className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Charging sessions will appear here once implemented.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <InfoRow label="Charge Point ID" value={charger.chargePointId} />
                <InfoRow label="OCPP Version" value={charger.ocppVersion} />
                <InfoRow label="Connector Count" value={String(charger.connectorCount)} />
                <InfoRow label="Max Power" value={`${charger.maxPowerKw} kW`} />
                <InfoRow label="Heartbeat Interval" value={`${charger.heartbeatInterval}s`} />
                <InfoRow label="Firmware Status" value={charger.firmwareStatus} />
                <InfoRow label="Diagnostics Status" value={charger.diagnosticsStatus} />
                <InfoRow label="Charge Box Serial" value={charger.chargeBoxSerialNumber || "—"} />
                <InfoRow
                  label="Created"
                  value={new Date(charger.createdAt).toLocaleDateString()}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ConnectorsTab({ charger }: { charger: Charger }) {
  // Placeholder connectors based on connector_count until connector.list API exists
  const connectors = Array.from({ length: charger.connectorCount }, (_, i) => ({
    id: i + 1,
    status: i === 0 ? charger.status : "Available",
  }))

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {connectors.map((conn) => (
        <Card key={conn.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <RiPlugLine className="h-4 w-4" />
                Connector {conn.id}
              </CardTitle>
              <Badge className={statusColor(conn.status)}>{conn.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {charger.maxPowerKw > 0 && <span>Max {charger.maxPowerKw} kW</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  )
}
