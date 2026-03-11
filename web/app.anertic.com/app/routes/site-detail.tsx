import { useNavigate, useParams } from "react-router"
import {
  RiArrowLeftLine,
  RiChargingPileLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
} from "@remixicon/react"
import { toast } from "sonner"
import useSWR from "swr"

import { api } from "~/lib/api"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

interface Site {
  id: string
  name: string
  address: string
  timezone: string
  createdAt: string
}

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
  lastHeartbeatAt: string | null
  createdAt: string
}

interface ChargerListResult {
  items: Charger[]
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

export default function SiteDetail() {
  const { siteId } = useParams()
  const navigate = useNavigate()

  const { data: site, isLoading: siteLoading } = useSWR(
    siteId ? ["site.get", siteId] : null,
    () => api<Site>("site.get", { id: siteId }),
    {
      onError(err) {
        toast.error(err instanceof Error ? err.message : "Failed to load site")
      },
    },
  )

  const { data: chargerData, isLoading: chargersLoading } = useSWR(
    siteId ? ["charger.list", siteId] : null,
    () => api<ChargerListResult>("charger.list", { siteId }),
  )

  const chargers = chargerData?.items || []
  const isLoading = siteLoading || chargersLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  if (!site) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/sites")}>
          <RiArrowLeftLine className="mr-2 h-4 w-4" />
          Back to Sites
        </Button>
        <p className="text-sm text-muted-foreground">Site not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => navigate("/sites")}
        >
          <RiArrowLeftLine className="mr-1 h-4 w-4" />
          Sites
        </Button>
        <h1 className="text-2xl font-semibold">{site.name}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          {site.address && <span>{site.address}</span>}
          <span>{site.timezone}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Chargers</p>
          <p className="mt-1 text-2xl font-semibold">{chargers.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Online</p>
          <p className="mt-1 text-2xl font-semibold">
            {chargers.filter((c) => c.lastHeartbeatAt).length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Charging</p>
          <p className="mt-1 text-2xl font-semibold">
            {chargers.filter((c) => c.status === "Charging").length}
          </p>
        </div>
      </div>

      {/* Chargers */}
      <div>
        <h2 className="mb-3 text-lg font-medium">Chargers</h2>
        {chargers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <RiChargingPileLine className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No chargers at this site yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {chargers.map((charger) => (
              <Card
                key={charger.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => navigate(`/chargers/${charger.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">
                        {charger.chargePointId}
                      </h3>
                      {(charger.vendor || charger.model) && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {[charger.vendor, charger.model]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                      )}
                    </div>
                    <Badge className={statusColor(charger.status)}>
                      {charger.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {charger.connectorCount} connector
                      {charger.connectorCount !== 1 ? "s" : ""}
                      {charger.maxPowerKw > 0 && ` · ${charger.maxPowerKw} kW`}
                    </span>
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
    </div>
  )
}
