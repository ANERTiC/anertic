import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import useSWR from 'swr'
import { toast } from 'sonner'

import { fetcher } from '~/lib/api'
import { api } from '~/lib/api.server'
import {
  RiCalendarCheckLine,
  RiCalendarCloseLine,
  RiAddLine,
  RiPlugLine,
  RiUserLine,
  RiTimeLine,
  RiArrowDownSLine,
  RiLoader4Line,
} from '@remixicon/react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { cn } from '~/lib/utils'

import type { Route } from './+types/reservations'
import {
  useChargerContext,
  reservationStatusColor,
  timeAgo,
  formatDateTime,
  type Reservation,
  type ConnectorDetail,
  type ReservationActionData,
} from './types'

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const { result } = await api<{ items: Reservation[] }>(
      request,
      'charger.listReservations',
      { id: params.chargerId }
    )
    return { reservations: result.items ?? [] }
  } catch {
    return { reservations: [] as Reservation[] }
  }
}

export async function clientAction({ request }: { request: Request }) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  switch (intent) {
    case 'reserveNow': {
      const id = String(formData.get('chargerId'))
      const connectorId = Number(formData.get('connectorId'))
      const idTag = String(formData.get('idTag'))
      const expiryDate = String(formData.get('expiryDate'))
      const parentIdTag = formData.get('parentIdTag')
        ? String(formData.get('parentIdTag'))
        : ''
      const reservationId = Number(formData.get('reservationId'))
      const result = await fetcher<{ id: string }>([
        'charger.reserveNow',
        { id, connectorId, idTag, expiryDate, parentIdTag, reservationId },
      ])
      return { ok: true, intent, ...result }
    }
    case 'cancelReservation': {
      const id = String(formData.get('chargerId'))
      const reservationId = Number(formData.get('reservationId'))
      await fetcher([
        'charger.cancelReservation',
        { id, reservationId },
      ])
      return { ok: true, intent, reservationId }
    }
    default:
      throw new Response('Invalid intent', { status: 400 })
  }
}

export default function ReservationsPage({ loaderData }: Route.ComponentProps) {
  const { charger } = useChargerContext()

  const {
    data: reservationsData,
    isLoading: loading,
    mutate: mutateReservations,
  } = useSWR<{ items: Reservation[] }>(
    ['charger.listReservations', { id: charger.id }],
    fetcher,
    { fallbackData: { items: loaderData.reservations } }
  )
  const reservations = reservationsData?.items ?? []
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [pastOpen, setPastOpen] = useState(false)

  const cancelFetcher = useFetcher<ReservationActionData>()
  const reserveFetcher = useFetcher<ReservationActionData>()

  useEffect(() => {
    if (reserveFetcher.state === 'idle' && reserveFetcher.data?.ok) {
      mutateReservations()
    }
  }, [reserveFetcher.state, reserveFetcher.data])

  useEffect(() => {
    if (cancelFetcher.state === 'idle' && cancelFetcher.data?.ok) {
      toast.success(
        `Reservation #${cancelFetcher.data.reservationId} cancelled`
      )
      mutateReservations()
    }
  }, [cancelFetcher.state, cancelFetcher.data])

  const cancellingId = cancelFetcher.formData
    ? Number(cancelFetcher.formData.get('reservationId'))
    : null
  const displayReservations = reservations.map((r) =>
    r.reservationId === cancellingId ? { ...r, status: 'Cancelled' } : r
  )

  const activeReservations = displayReservations.filter(
    (r) => r.status === 'Active'
  )
  const pastReservations = displayReservations.filter(
    (r) => r.status !== 'Active'
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Reservations</h3>
        <Button size="sm" onClick={() => setNewDialogOpen(true)}>
          <RiAddLine aria-hidden="true" data-icon="inline-start" />
          New Reservation
        </Button>
      </div>

      {reservations.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
          <RiCalendarCheckLine
            aria-hidden="true"
            className="size-10 text-muted-foreground/40"
          />
          <p className="mt-3 text-sm font-medium">No reservations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reserve a connector to hold it for a specific ID tag.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setNewDialogOpen(true)}
          >
            <RiAddLine aria-hidden="true" data-icon="inline-start" />
            Create First Reservation
          </Button>
        </div>
      )}

      {activeReservations.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Active
          </p>
          {activeReservations.map((r) => (
            <ReservationCard
              key={r.reservationId}
              reservation={r}
              chargerId={charger.id}
              cancelFetcher={cancelFetcher}
            />
          ))}
        </div>
      )}

      {pastReservations.length > 0 && (
        <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase hover:text-foreground"
            >
              <RiArrowDownSLine
                aria-hidden="true"
                className={cn(
                  'size-3.5 transition-transform',
                  pastOpen && 'rotate-180'
                )}
              />
              Past ({pastReservations.length})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 flex flex-col gap-2">
            {pastReservations.map((r) => (
              <ReservationCard
                key={r.reservationId}
                reservation={r}
                chargerId={charger.id}
                cancelFetcher={cancelFetcher}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      <NewReservationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        chargerId={charger.id}
        connectors={charger.connectors}
        reserveFetcher={reserveFetcher}
      />
    </div>
  )
}

function ReservationCard({
  reservation,
  chargerId,
  cancelFetcher,
}: {
  reservation: Reservation
  chargerId: string
  cancelFetcher: ReturnType<typeof useFetcher<ReservationActionData>>
}) {
  const isActive = reservation.status === 'Active'
  const cancellingId = cancelFetcher.formData
    ? Number(cancelFetcher.formData.get('reservationId'))
    : null
  const isCancelling = cancellingId === reservation.reservationId
  const expiryDate = new Date(reservation.expiryDate)
  const isExpired = expiryDate.getTime() < Date.now()

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
        isActive && !isExpired
          ? 'border-emerald-200 bg-emerald-50/30'
          : 'bg-muted/20'
      )}
    >
      <span className="flex shrink-0 items-center justify-center rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
        #{reservation.connectorId}
      </span>
      <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground tabular-nums">
        R-{reservation.reservationId}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {reservation.idTag}
      </span>
      {reservation.parentIdTag && (
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          via {reservation.parentIdTag}
        </span>
      )}
      <span
        className={cn(
          'shrink-0 text-xs tabular-nums',
          isActive && !isExpired ? 'text-emerald-700' : 'text-muted-foreground'
        )}
      >
        {isActive && !isExpired
          ? `Expires ${timeAgo(reservation.expiryDate).replace(' ago', ' left').replace('Just now', 'now')}`
          : formatDateTime(reservation.expiryDate)}
      </span>
      <Badge
        className={cn(
          'shrink-0 text-[10px]',
          reservationStatusColor(reservation.status)
        )}
      >
        {reservation.status}
      </Badge>
      {isActive && (
        <cancelFetcher.Form method="post">
          <input type="hidden" name="intent" value="cancelReservation" />
          <input type="hidden" name="chargerId" value={chargerId} />
          <input
            type="hidden"
            name="reservationId"
            value={reservation.reservationId}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 border-red-200 text-xs text-red-600 hover:bg-red-50"
            disabled={isCancelling}
          >
            {isCancelling ? (
              <RiLoader4Line
                aria-hidden="true"
                className="size-3 animate-spin"
              />
            ) : (
              <>
                <RiCalendarCloseLine
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Cancel
              </>
            )}
          </Button>
        </cancelFetcher.Form>
      )}
    </div>
  )
}

function NewReservationDialog({
  open,
  onOpenChange,
  chargerId,
  connectors,
  reserveFetcher,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chargerId: string
  connectors: ConnectorDetail[]
  reserveFetcher: ReturnType<typeof useFetcher<ReservationActionData>>
}) {
  const defaultExpiry = () => {
    const d = new Date(Date.now() + 30 * 60000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [connectorId, setConnectorId] = useState<number | null>(null)
  const [idTag, setIdTag] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [expiryDate, setExpiryDate] = useState(defaultExpiry)
  const [parentIdTag, setParentIdTag] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const submitting = reserveFetcher.state === 'submitting'

  function reset() {
    setConnectorId(null)
    setIdTag('')
    setReservationId('')
    setExpiryDate(defaultExpiry())
    setParentIdTag('')
    setAdvancedOpen(false)
  }

  function handleClose() {
    onOpenChange(false)
    setTimeout(reset, 200)
  }

  useEffect(() => {
    if (reserveFetcher.state === 'idle' && reserveFetcher.data?.ok) {
      toast.success(`Connector #${connectorId} reserved for ${idTag.trim()}`)
      handleClose()
    }
  }, [reserveFetcher.state, reserveFetcher.data])

  function validate(): string | null {
    if (connectorId === null) return 'Please select a connector'
    if (!idTag.trim()) return 'ID tag is required'
    if (!reservationId.trim() || isNaN(Number(reservationId))) {
      return 'A valid reservation ID is required'
    }
    if (!expiryDate) return 'Expiry date is required'
    if (new Date(expiryDate).getTime() <= Date.now()) {
      return 'Expiry date must be in the future'
    }
    return null
  }

  function handleSubmit() {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    reserveFetcher.submit(
      {
        intent: 'reserveNow',
        chargerId,
        connectorId: String(connectorId),
        idTag: idTag.trim(),
        expiryDate: new Date(expiryDate).toISOString(),
        parentIdTag: parentIdTag.trim(),
        reservationId,
      },
      { method: 'post' }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <RiCalendarCheckLine
                aria-hidden="true"
                className="size-4 text-emerald-600"
              />
            </div>
            New Reservation
          </DialogTitle>
          <DialogDescription>
            Reserve a connector for a specific ID tag and time window.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="grid gap-2">
            <Label className="text-xs">Connector</Label>
            <div className="flex gap-2">
              {connectors.map((conn) => {
                const isAvailable = conn.status === 'Available'
                return (
                  <button
                    key={conn.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => setConnectorId(conn.id)}
                    className={cn(
                      'flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-2.5 text-xs transition-colors',
                      connectorId === conn.id
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700'
                        : isAvailable
                          ? 'hover:border-foreground/30 hover:bg-muted/50'
                          : 'cursor-not-allowed opacity-40'
                    )}
                  >
                    <RiPlugLine aria-hidden="true" className="size-4" />
                    <span className="font-semibold">#{conn.id}</span>
                    <span
                      className={cn(
                        'text-[10px]',
                        isAvailable
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {conn.status}
                    </span>
                  </button>
                )
              })}
            </div>
            {connectors.every((c) => c.status !== 'Available') && (
              <p className="text-[10px] text-amber-600">
                No connectors are currently available for reservation.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="res-idTag"
              className="flex items-center gap-1.5 text-xs"
            >
              <RiUserLine aria-hidden="true" className="size-3" />
              ID Tag
            </Label>
            <Input
              id="res-idTag"
              placeholder="e.g. USER-001"
              value={idTag}
              onChange={(e) => setIdTag(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="res-id" className="text-xs">
              Reservation ID
            </Label>
            <Input
              id="res-id"
              type="number"
              min="1"
              placeholder="e.g. 102"
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">
              A unique numeric ID for this reservation (OCPP field).
            </p>
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="res-expiry"
              className="flex items-center gap-1.5 text-xs"
            >
              <RiTimeLine aria-hidden="true" className="size-3" />
              Expiry Date &amp; Time
            </Label>
            <Input
              id="res-expiry"
              type="datetime-local"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RiArrowDownSLine
                  aria-hidden="true"
                  className={cn(
                    'size-3.5 transition-transform',
                    advancedOpen && 'rotate-180'
                  )}
                />
                Advanced options
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="grid gap-2">
                <Label htmlFor="res-parentIdTag" className="text-xs">
                  Parent ID Tag{' '}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="res-parentIdTag"
                  placeholder="e.g. FLEET-A"
                  value={parentIdTag}
                  onChange={(e) => setParentIdTag(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Group tag for fleet or shared authorization.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <RiLoader4Line
                  aria-hidden="true"
                  data-icon="inline-start"
                  className="animate-spin"
                />
                Reserving…
              </>
            ) : (
              <>
                <RiCalendarCheckLine
                  aria-hidden="true"
                  data-icon="inline-start"
                />
                Reserve Connector
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
