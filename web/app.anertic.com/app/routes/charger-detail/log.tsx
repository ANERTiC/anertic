import useSWR from 'swr'

import { fetcher } from '~/lib/api'
import { api } from '~/lib/api.server'
import { Card, CardContent } from '~/components/ui/card'
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

export default function LogPage({ loaderData }: Route.ComponentProps) {
  const { charger } = useChargerContext()

  const { data: eventsData } = useSWR<{ items: OcppEvent[] }>(
    ['charger.listEvents', { chargerId: charger.id, limit: 50 }],
    fetcher,
    { fallbackData: { items: loaderData.events } }
  )
  const events = eventsData?.items ?? []

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase',
                  event.direction === 'in'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-amber-500/10 text-amber-600'
                )}
              >
                {event.direction === 'in' ? 'IN' : 'OUT'}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {event.action}
              </span>
              {event.payload && (
                <span className="hidden truncate text-xs text-muted-foreground lg:block lg:max-w-[300px]">
                  {event.payload}
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDateTime(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
