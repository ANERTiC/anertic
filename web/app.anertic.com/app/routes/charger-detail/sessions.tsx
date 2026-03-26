import { useState } from 'react'
import useSWR from 'swr'

import { fetcher } from '~/lib/api'
import { api } from '~/lib/api.server'
import {
  RiPlugLine,
  RiTimeLine,
  RiArrowDownSLine,
  RiChargingPile2Line,
} from '@remixicon/react'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'

import type { Route } from './+types/sessions'
import {
  useChargerContext,
  statusColor,
  formatPower,
  sessionDuration,
  formatTime,
  type Session,
} from './types'

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const { result } = await api<{ items: Session[] }>(
      request,
      'charger.listSessions',
      { chargerId: params.chargerId }
    )
    return { sessions: result.items ?? [] }
  } catch {
    return { sessions: [] as Session[] }
  }
}

export default function SessionsPage({ loaderData }: Route.ComponentProps) {
  const { charger } = useChargerContext()
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const { data: sessionsData } = useSWR<{ items: Session[] }>(
    ['charger.listSessions', { chargerId: charger.id }],
    fetcher,
    { fallbackData: { items: loaderData.sessions } }
  )
  const sessions = sessionsData?.items ?? []

  if (sessions.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-gradient-to-b from-muted/30 to-background">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute top-6 left-1/2 h-px w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="absolute top-10 left-1/2 h-px w-16 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        </div>
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 scale-150 rounded-full bg-primary/5 motion-safe:animate-ping [animation-duration:3s]" />
            <div className="relative flex size-14 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
              <RiChargingPile2Line
                aria-hidden="true"
                className="size-6 text-muted-foreground/60"
              />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            No charging sessions yet
          </h3>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Sessions will appear here when a vehicle connects and starts
            charging.
          </p>
        </div>
      </div>
    )
  }

  const activeSessions = sessions.filter((s) => s.status === 'Active')
  const completedSessions = sessions.filter((s) => s.status === 'Completed')

  return (
    <div className="flex flex-col gap-4">
      {activeSessions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Active ({activeSessions.length})
          </p>
          {activeSessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              selected={selectedSession?.id === s.id}
              onClick={() =>
                setSelectedSession(
                  selectedSession?.id === s.id ? null : s
                )
              }
            />
          ))}
        </div>
      )}
      {completedSessions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Completed ({completedSessions.length})
          </p>
          {completedSessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              selected={selectedSession?.id === s.id}
              onClick={() =>
                setSelectedSession(
                  selectedSession?.id === s.id ? null : s
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SessionRow({
  session,
  selected,
  onClick,
}: {
  session: Session
  selected: boolean
  onClick: () => void
}) {
  const isActive = session.status === 'Active'

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors',
          isActive && 'border-blue-200 bg-blue-50/30',
          !isActive && 'hover:bg-muted/50',
          selected && !isActive && 'border-foreground/20 bg-muted/30',
          selected && 'rounded-b-none'
        )}
      >
        <span className="relative flex size-2.5">
          {isActive && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75 motion-reduce:animate-none" />
          )}
          <span
            className={cn(
              'relative inline-flex size-2.5 rounded-full',
              isActive ? 'bg-blue-500' : 'bg-gray-300'
            )}
          />
        </span>

        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <RiPlugLine aria-hidden="true" className="size-3" />#
          {session.connectorId}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {session.idTag || '—'}
        </span>

        <span className="text-sm font-semibold tabular-nums">
          {Number(session.energyKwh).toFixed(1)} kWh
        </span>

        <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
          {formatPower(Number(session.maxPowerKw))} peak
        </span>

        <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <RiTimeLine aria-hidden="true" className="size-3" />
          {sessionDuration(session.startedAt, session.endedAt)}
        </span>

        <span className="text-xs text-muted-foreground tabular-nums">
          {formatTime(session.startedAt)}
        </span>

        <RiArrowDownSLine
          aria-hidden="true"
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            selected && 'rotate-180'
          )}
        />
      </button>

      {selected && <SessionDetail session={session} />}
    </div>
  )
}

function SessionDetail({ session }: { session: Session }) {
  const isActive = session.status === 'Active'

  return (
    <div
      className={cn(
        'rounded-b-lg border border-t-0 px-5 py-4',
        isActive
          ? 'border-blue-200 bg-blue-50/20'
          : 'border-foreground/20 bg-muted/20'
      )}
    >
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Transaction ID
          </p>
          <p className="mt-0.5 font-mono text-sm font-semibold">
            #{session.transactionId}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            ID Tag
          </p>
          <p className="mt-0.5 font-mono text-sm">{session.idTag || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Connector
          </p>
          <p className="mt-0.5 text-sm">#{session.connectorId}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Energy Delivered
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">
            {Number(session.energyKwh).toFixed(2)} kWh
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Duration
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {sessionDuration(session.startedAt, session.endedAt)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Peak Power
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {formatPower(Number(session.maxPowerKw))}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Status
          </p>
          <Badge
            className={cn(
              'mt-0.5 text-[10px]',
              isActive
                ? 'bg-blue-500/15 text-blue-700'
                : 'bg-emerald-500/15 text-emerald-700'
            )}
          >
            {session.status}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Started
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {new Date(session.startedAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
            Ended
          </p>
          <p className="mt-0.5 text-sm tabular-nums">
            {session.endedAt
              ? new Date(session.endedAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'In progress'}
          </p>
        </div>
        {session.stopReason && (
          <div>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Stop Reason
            </p>
            <p className="mt-0.5 text-sm">{session.stopReason}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-md border bg-background/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Meter Start:</span>
          <span className="font-mono tabular-nums">
            {session.meterStart.toLocaleString()} Wh
          </span>
        </div>
        <span className="text-muted-foreground">&rarr;</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Meter Stop:</span>
          <span className="font-mono tabular-nums">
            {session.meterStop !== null
              ? `${session.meterStop.toLocaleString()} Wh`
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
