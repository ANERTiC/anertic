import { useState } from 'react'
import useSWR from 'swr'
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiFileCopyLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
} from '@remixicon/react'

import { fetcher } from '~/lib/api'
import { api } from '~/lib/api.server'
import { Card, CardContent } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

import type { Route } from './+types/log'
import { useChargerContext, formatDateTime, type OcppEvent } from './types'

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const { result } = await api<{ items: OcppEvent[] }>(
      request,
      'charger.listEvents',
      { chargerId: params.chargerId, limit: 50 }
    )
    return { events: result.items ?? [] }
  } catch {
    return { events: [] as OcppEvent[] }
  }
}

function formatPayload(raw: string | null): string {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="size-6"
      onClick={handleCopy}
    >
      {copied ? (
        <RiCheckLine className="size-3.5 text-emerald-500 motion-safe:animate-scale-fade-in" />
      ) : (
        <RiFileCopyLine className="size-3.5" />
      )}
    </Button>
  )
}

function PayloadBlock({
  label,
  payload,
  variant = 'default',
}: {
  label: string
  payload: string
  variant?: 'default' | 'error'
}) {
  const formatted = formatPayload(payload)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <CopyButton text={formatted} />
      </div>
      <pre
        className={cn(
          'overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed',
          variant === 'error'
            ? 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400'
            : 'bg-muted/50'
        )}
      >
        {formatted}
      </pre>
    </div>
  )
}

export default function LogPage({ loaderData }: Route.ComponentProps) {
  const { charger } = useChargerContext()
  const [selected, setSelected] = useState<OcppEvent | null>(null)
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('')

  const swrKey = [
    'charger.listEvents',
    {
      chargerId: charger.id,
      limit: 50,
      ...(search && { search }),
      ...(direction && { direction }),
    },
  ]

  const { data: eventsData } = useSWR<{ items: OcppEvent[] }>(
    swrKey,
    fetcher,
    {
      fallbackData:
        !search && !direction ? { items: loaderData.events } : undefined,
    }
  )
  const events = eventsData?.items ?? []

  return (
    <div
      className={cn(
        'grid gap-4 transition-[grid-template-columns] duration-200',
        selected ? 'lg:grid-cols-[1fr_420px]' : 'grid-cols-1'
      )}
    >
      {/* Event list */}
      <Card>
        <CardContent className="p-0">
          {/* Search & filter bar */}
          <div className="flex items-center gap-2 border-b px-4 py-2.5">
            <div className="relative flex-1">
              <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search action or payload..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              <option value="">All</option>
              <option value="in">RX (In)</option>
              <option value="out">TX (Out)</option>
            </select>
          </div>

          <div className="divide-y">
            {events.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {search || direction
                  ? 'No matching messages'
                  : 'No OCPP messages yet'}
              </div>
            )}
            {events.map((event, i) => {
              const isSelected = selected?.messageId === event.messageId
              const hasError = event.responseType === 4

              return (
                <button
                  key={event.messageId}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    'cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    'motion-safe:animate-fade-in-up',
                    isSelected && 'bg-muted/70',
                    hasError && 'bg-red-500/[0.03]'
                  )}
                  style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
                  onClick={() =>
                    setSelected(isSelected ? null : event)
                  }
                >
                  {isSelected ? (
                    <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <RiArrowRightSLine className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                      event.direction === 'in'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    {event.direction === 'in' ? 'RX' : 'TX'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {event.action}
                  </span>
                  {event.durationMs != null && (
                    <span
                      className={cn(
                        'shrink-0 text-xs tabular-nums',
                        event.durationMs > 1000
                          ? 'text-amber-600'
                          : 'text-muted-foreground'
                      )}
                    >
                      {event.durationMs}ms
                    </span>
                  )}
                  {hasError && (
                    <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                      ERR
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(event.requestAt)}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detail panel */}
      {selected && (
        <Card className="sticky top-4 h-fit max-h-[calc(100vh-8rem)] overflow-hidden motion-safe:animate-slide-in-right">
          <CardContent className="flex h-full flex-col gap-0 p-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                      selected.direction === 'in'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-amber-500/10 text-amber-600'
                    )}
                  >
                    {selected.direction === 'in' ? 'RX' : 'TX'}
                  </span>
                  <span className="truncate text-sm font-semibold">
                    {selected.action}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatDateTime(selected.requestAt)}</span>
                  {selected.durationMs != null && (
                    <span className="tabular-nums">
                      {selected.durationMs}ms
                    </span>
                  )}
                  <span
                    className="truncate font-mono text-[10px]"
                    title={selected.messageId}
                  >
                    {selected.messageId}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelected(null)}
              >
                <RiCloseLine className="size-4" />
              </Button>
            </div>

            {/* Payload content */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {selected.request && (
                <PayloadBlock label="Request" payload={selected.request} />
              )}
              {selected.response && (
                <PayloadBlock
                  label="Response"
                  payload={selected.response}
                  variant={
                    selected.responseType === 4 ? 'error' : 'default'
                  }
                />
              )}
              {selected.errorCode && (
                <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
                  <div className="text-[10px] font-semibold tracking-wider text-red-600 uppercase">
                    Error
                  </div>
                  <div className="mt-1 font-mono text-xs text-red-700 dark:text-red-400">
                    {selected.errorCode}
                    {selected.errorDesc && `: ${selected.errorDesc}`}
                  </div>
                </div>
              )}
              {!selected.request && !selected.response && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No payload data
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
