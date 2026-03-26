import { Suspense, useState } from 'react'
import { Await, Link, NavLink, Outlet } from 'react-router'
import useSWR from 'swr'

import { fetcher } from '~/lib/api'
import { api } from '~/lib/api.server'
import {
  RiArrowLeftLine,
  RiFlashlightLine,
  RiPlugLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiTimeLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiRestartLine,
  RiShutDownLine,
  RiBarChartBoxLine,
  RiHistoryLine,
  RiCalendarCheckLine,
  RiInformationLine,
  RiSettings3Line,
  RiRemoteControlLine,
  RiChargingPile2Line,
  RiUserLine,
  RiSpeedLine,
  RiLinksLine,
  RiFileCopyLine,
  RiCheckLine,
} from '@remixicon/react'
import { toast } from 'sonner'

import { useSiteId } from '~/layouts/site'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { cn } from '~/lib/utils'

import type { Route } from './+types/charger-detail'
import type {
  Charger,
  ConnectorDetail,
  AuthTag,
  ChargerOutletContext,
} from './charger-detail/types'
import {
  statusColor,
  statusDot,
  registrationColor,
  timeAgo,
  formatPower,
  sessionDuration,
  OCPP_BASE_URL,
} from './charger-detail/types'

// --- Revalidation ---

export function shouldRevalidate({
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}: {
  currentParams: Record<string, string>
  nextParams: Record<string, string>
  defaultShouldRevalidate: boolean
}) {
  // Skip refetch when switching tabs within the same charger
  if (currentParams.chargerId === nextParams.chargerId) {
    return false
  }
  return defaultShouldRevalidate
}

// --- Server Loader ---

export async function loader({ params, request }: Route.LoaderArgs) {
  const charger = api<Charger>(request, 'charger.get', {
    id: params.chargerId,
  }).then((r) => r.result)

  return { charger }
}

// --- Layout ---

const tabs = [
  { to: '.', label: 'Analytics', icon: RiBarChartBoxLine, end: true },
  { to: 'sessions', label: 'Sessions', icon: RiHistoryLine, end: false },
  {
    to: 'reservations',
    label: 'Reservations',
    icon: RiCalendarCheckLine,
    end: false,
  },
  { to: 'info', label: 'Device Info', icon: RiInformationLine, end: false },
  { to: 'settings', label: 'Settings', icon: RiSettings3Line, end: false },
  { to: 'commands', label: 'Commands', icon: RiRemoteControlLine, end: false },
  { to: 'log', label: 'OCPP Logs', icon: RiHistoryLine, end: false },
]

function ChargerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

export default function ChargerDetailLayout({
  loaderData,
}: Route.ComponentProps) {
  return (
    <Suspense fallback={<ChargerDetailSkeleton />}>
      <Await resolve={loaderData.charger}>
        {(charger) => <ChargerDetailContent initial={charger} />}
      </Await>
    </Suspense>
  )
}

function ChargerDetailContent({ initial }: { initial: Charger }) {
  const siteId = useSiteId()
  const siteParam = siteId ? `?site=${siteId}` : ''

  const { data: charger } = useSWR<Charger>(
    ['charger.get', { id: initial.id }],
    fetcher,
    { fallbackData: initial, refreshInterval: 15000 }
  )

  if (!charger) return <ChargerDetailSkeleton />

  const isCharging =
    charger.status === 'Charging' || charger.status === 'Preparing'
  const isFaulted = charger.status === 'Faulted'
  const isOnline = !!charger.lastHeartbeatAt

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
              <Link to={`/chargers${siteParam}`}>
                <RiArrowLeftLine aria-hidden="true" data-icon="inline-start" />
                Chargers
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <span className="relative flex size-3">
                {isCharging && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75 motion-reduce:animate-none" />
                )}
                {isFaulted && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
                )}
                <span
                  className={cn(
                    'relative inline-flex size-3 rounded-full',
                    statusDot(charger.status)
                  )}
                />
              </span>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {charger.chargePointId}
              </h1>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge className={cn('text-[10px]', statusColor(charger.status))}>
                {charger.status}
              </Badge>
              <Badge
                className={cn(
                  'text-[10px]',
                  registrationColor(charger.registrationStatus)
                )}
              >
                {charger.registrationStatus}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {isOnline ? (
                  <RiSignalWifiLine
                    aria-hidden="true"
                    className="size-3 text-emerald-500"
                  />
                ) : (
                  <RiSignalWifiOffLine
                    aria-hidden="true"
                    className="size-3 text-red-400"
                  />
                )}
                {timeAgo(charger.lastHeartbeatAt)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {charger.vendor} {charger.model}
            </p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button variant="outline" size="sm">
              <RiRestartLine aria-hidden="true" data-icon="inline-start" />
              Reset
            </Button>
            <Button variant="outline" size="sm">
              <RiShutDownLine aria-hidden="true" data-icon="inline-start" />
              Reboot
            </Button>
          </div>
        </div>
        {/* Mobile action buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button variant="outline" size="sm" className="flex-1">
            <RiRestartLine aria-hidden="true" data-icon="inline-start" />
            Reset
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <RiShutDownLine aria-hidden="true" data-icon="inline-start" />
            Reboot
          </Button>
        </div>
      </div>

      {/* Connectors */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Connectors
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {charger.connectors.map((conn) => (
            <ConnectorCard
              key={conn.id}
              connector={conn}
              chargerId={charger.id}
            />
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="flex w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={`${tab.to}${siteParam}`}
            end={tab.end}
            prefetch="intent"
            className={({ isActive }) =>
              cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
              )
            }
          >
            <tab.icon aria-hidden="true" className="size-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Tab Content */}
      <Outlet context={{ charger } satisfies ChargerOutletContext} />
    </div>
  )
}

// --- ConnectorCard ---

function ConnectorCard({
  connector,
  chargerId,
}: {
  connector: ConnectorDetail
  chargerId: string
}) {
  const isActive =
    connector.status === 'Charging' || connector.status === 'Preparing'
  const isSuspended =
    connector.status === 'SuspendedEV' || connector.status === 'SuspendedEVSE'
  const isFaulted = connector.status === 'Faulted'
  const powerPercent =
    Number(connector.maxPowerKw) > 0
      ? (Number(connector.powerKw) / Number(connector.maxPowerKw)) * 100
      : 0

  const [startOpen, setStartOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)

  return (
    <>
      <Card
        className={cn(
          'overflow-hidden',
          isFaulted && 'border-red-200',
          isActive && 'border-blue-200'
        )}
      >
        <CardContent className="p-0">
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <RiPlugLine
                    aria-hidden="true"
                    className="size-5 text-muted-foreground"
                  />
                  <span
                    className={cn(
                      'absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-white',
                      statusDot(connector.status)
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Connector {connector.id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {connector.connectorType || 'Type 2'} &middot;{' '}
                    {connector.maxPowerKw} kW max
                  </p>
                </div>
              </div>
              <Badge
                className={cn('text-[10px]', statusColor(connector.status))}
              >
                {connector.status}
              </Badge>
            </div>

            {isActive && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">
                    {connector.vehicleId || 'Unknown vehicle'}
                  </p>
                  {connector.sessionStartedAt && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <RiTimeLine aria-hidden="true" className="size-3" />
                      {sessionDuration(connector.sessionStartedAt)}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Power</p>
                    <p className="text-lg font-bold text-blue-700 tabular-nums">
                      {formatPower(Number(connector.powerKw))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Session Energy
                    </p>
                    <p className="text-lg font-bold tabular-nums">
                      {Number(connector.sessionKwh).toFixed(1)}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        kWh
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Power utilization</span>
                    <span className="tabular-nums">
                      {powerPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-[width] duration-1000"
                      style={{ width: `${powerPercent}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-red-200 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => setStopOpen(true)}
                    disabled={!connector.transactionId}
                  >
                    <RiShutDownLine
                      aria-hidden="true"
                      data-icon="inline-start"
                    />
                    Stop Charging
                  </Button>
                </div>
              </div>
            )}

            {isSuspended && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">
                    {connector.vehicleId || 'Unknown vehicle'}
                  </p>
                  <span className="text-[10px] font-medium text-amber-600">
                    Paused
                  </span>
                </div>
                <p className="mt-1 text-sm tabular-nums">
                  {Number(connector.sessionKwh).toFixed(1)} kWh delivered
                </p>
              </div>
            )}

            {isFaulted && connector.errorCode !== 'NoError' && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50/30 p-3">
                <div className="flex items-center gap-2">
                  <RiAlertLine
                    aria-hidden="true"
                    className="size-4 text-red-500"
                  />
                  <p className="text-xs font-medium text-red-700">
                    {connector.errorCode}
                  </p>
                </div>
              </div>
            )}

            {connector.status === 'Available' && (
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RiCheckboxCircleLine
                    aria-hidden="true"
                    className="size-4 text-emerald-500"
                  />
                  Ready to charge
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setStartOpen(true)}
                >
                  <RiFlashlightLine
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  Start Charging
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <StartChargingDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        chargerId={chargerId}
        connectorId={connector.id}
        maxPowerKw={connector.maxPowerKw}
        connectorType={connector.connectorType}
      />

      <StopChargingDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        chargerId={chargerId}
        connectorId={connector.id}
        transactionId={connector.transactionId}
        vehicleId={connector.vehicleId}
        sessionKwh={connector.sessionKwh}
        sessionStartedAt={connector.sessionStartedAt}
      />
    </>
  )
}

// --- StartChargingDialog ---

function StartChargingDialog({
  open,
  onOpenChange,
  chargerId,
  connectorId,
  maxPowerKw,
  connectorType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chargerId: string
  connectorId: number
  maxPowerKw: string
  connectorType: string
}) {
  const [idTag, setIdTag] = useState('')
  const [powerLimit, setPowerLimit] = useState(maxPowerKw)
  const [step, setStep] = useState<'form' | 'submitting' | 'success'>('form')

  const { data: authData } = useSWR<{ items: AuthTag[] }>(
    open ? ['charger.listAuthTags', { id: chargerId }] : null,
    fetcher
  )
  const authTags = authData?.items ?? []

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      setIdTag('')
      setPowerLimit(String(maxPowerKw))
      setStep('form')
    }, 200)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idTag) return
    setStep('submitting')
    try {
      await fetcher([
        'charger.remoteStart',
        { id: chargerId, connectorId, idTag, powerLimitKw: Number(powerLimit) },
      ])
      setStep('success')
    } catch {
      toast.error('Failed to start charging')
      setStep('form')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <RiChargingPile2Line
                    aria-hidden="true"
                    className="size-4 text-blue-600"
                  />
                </div>
                Start Charging
              </DialogTitle>
              <DialogDescription>
                Send a remote start command to connector #{connectorId}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                <RiPlugLine
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                <div className="flex-1 text-xs">
                  <span className="font-medium">Connector {connectorId}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    &middot; {connectorType || 'Type 2'} &middot; {maxPowerKw}{' '}
                    kW
                  </span>
                </div>
                <Badge className="bg-emerald-500/15 text-[10px] text-emerald-700">
                  Available
                </Badge>
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="startIdTag"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <RiUserLine aria-hidden="true" className="size-3" />
                  ID Tag / Identifier
                </Label>
                <select
                  id="startIdTag"
                  value={idTag}
                  onChange={(e) => setIdTag(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  required
                  autoFocus
                >
                  <option value="">Select an ID tag...</option>
                  {authTags.map((tag) => (
                    <option key={tag.id} value={tag.idTag}>
                      {tag.idTag}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  {authTags.length === 0
                    ? 'No tags configured — add one in Settings'
                    : 'Select an authorized ID tag from the local auth list'}
                </p>
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="powerLimit"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <RiSpeedLine aria-hidden="true" className="size-3" />
                  Power Limit (kW)
                </Label>
                <Input
                  id="powerLimit"
                  type="number"
                  min="0"
                  max={maxPowerKw || undefined}
                  step="0.1"
                  value={powerLimit}
                  onChange={(e) => setPowerLimit(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  {Number(maxPowerKw) > 0
                    ? `Max: ${maxPowerKw} kW. Set 0 for no limit.`
                    : 'Set 0 for no limit.'}
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!idTag}>
                  <RiFlashlightLine
                    aria-hidden="true"
                    data-icon="inline-start"
                  />
                  Start Charging
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center py-10">
            <div className="relative">
              <div className="size-16 animate-spin rounded-full border-4 border-blue-100 border-t-blue-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RiChargingPile2Line
                  aria-hidden="true"
                  className="size-6 text-blue-500"
                />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">
              Sending RemoteStartTransaction…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connector #{connectorId} &middot; ID Tag: {idTag}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center py-10">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <RiCheckboxCircleLine
                aria-hidden="true"
                className="size-8 text-emerald-500"
              />
            </div>
            <p className="mt-4 text-sm font-medium">Command Sent</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              RemoteStartTransaction sent to connector #{connectorId}.
              <br />
              Waiting for the charger to accept and begin charging.
            </p>
            <div className="mt-4 w-full rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="grid gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID Tag</span>
                  <span className="font-medium">{idTag}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Power Limit</span>
                  <span className="font-medium tabular-nums">
                    {powerLimit} kW
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connector</span>
                  <span className="font-medium">#{connectorId}</span>
                </div>
              </div>
            </div>
            <Button className="mt-4" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// --- StopChargingDialog ---

function StopChargingDialog({
  open,
  onOpenChange,
  chargerId,
  connectorId,
  transactionId,
  vehicleId,
  sessionKwh,
  sessionStartedAt,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chargerId: string
  connectorId: number
  transactionId: number | null
  vehicleId?: string
  sessionKwh: string
  sessionStartedAt?: string
}) {
  const [step, setStep] = useState<'confirm' | 'stopping' | 'stopped'>(
    'confirm'
  )

  async function handleStop() {
    if (!transactionId) return
    setStep('stopping')
    try {
      await fetcher([
        'charger.remoteStop',
        { id: chargerId, transactionId },
      ])
      setStep('stopped')
    } catch {
      toast.error('Failed to stop charging')
      setStep('confirm')
    }
  }

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      setStep('confirm')
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-red-500/10">
                  <RiShutDownLine
                    aria-hidden="true"
                    className="size-4 text-red-600"
                  />
                </div>
                Stop Charging
              </DialogTitle>
              <DialogDescription>
                This will send a remote stop command to connector #{connectorId}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/30 px-3 py-3">
              <div className="grid gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connector</span>
                  <span className="font-medium">#{connectorId}</span>
                </div>
                {vehicleId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle</span>
                    <span className="font-medium">{vehicleId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Energy Delivered
                  </span>
                  <span className="font-medium tabular-nums">
                    {Number(sessionKwh).toFixed(1)} kWh
                  </span>
                </div>
                {sessionStartedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium tabular-nums">
                      {sessionDuration(sessionStartedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleStop}>
                <RiShutDownLine aria-hidden="true" data-icon="inline-start" />
                Stop Charging
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'stopping' && (
          <div className="flex flex-col items-center py-10">
            <div className="relative">
              <div className="size-16 animate-spin rounded-full border-4 border-red-100 border-t-red-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RiShutDownLine
                  aria-hidden="true"
                  className="size-6 text-red-500"
                />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">
              Sending RemoteStopTransaction…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connector #{connectorId}
            </p>
          </div>
        )}

        {step === 'stopped' && (
          <div className="flex flex-col items-center py-10">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
              <RiCheckboxCircleLine
                aria-hidden="true"
                className="size-8 text-emerald-500"
              />
            </div>
            <p className="mt-4 text-sm font-medium">Charging Stopped</p>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              RemoteStopTransaction sent successfully.
              <br />
              The charger will finalize the session.
            </p>
            <Button className="mt-4" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// --- OcppUrlStrip (exported for settings) ---

export function OcppUrlStrip({
  chargePointId,
}: {
  chargePointId: string
}) {
  const [copied, setCopied] = useState(false)
  const url = `${OCPP_BASE_URL}/${chargePointId}`

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-2 flex items-center gap-0">
      <div className="flex min-w-0 items-center gap-1.5 rounded-l-md border border-r-0 bg-muted/50 px-2.5 py-1">
        <RiLinksLine
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground"
        />
        <span className="truncate font-mono text-[11px] text-muted-foreground select-all">
          {url}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-auto shrink-0 rounded-l-none px-2 py-1"
        onClick={handleCopy}
      >
        {copied ? (
          <RiCheckLine aria-hidden="true" className="size-3 text-emerald-500" />
        ) : (
          <RiFileCopyLine aria-hidden="true" className="size-3" />
        )}
      </Button>
    </div>
  )
}
