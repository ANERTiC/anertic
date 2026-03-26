import useSWR from 'swr'

import { fetcher } from '~/lib/api'
import { api } from '~/lib/api.server'
import { Card, CardContent } from '~/components/ui/card'
import { Skeleton } from '~/components/ui/skeleton'
import { cn } from '~/lib/utils'

import type { Route } from './+types/analytics'
import {
  useChargerContext,
  dailyLabel,
  type AnalyticsResult,
} from './types'

export async function loader({ params, request }: Route.LoaderArgs) {
  try {
    const { result } = await api<AnalyticsResult>(
      request,
      'charger.analytics',
      { chargerId: params.chargerId, days: 7 }
    )
    return { analytics: result }
  } catch {
    return { analytics: null as AnalyticsResult | null }
  }
}

export default function AnalyticsPage({ loaderData }: Route.ComponentProps) {
  const { charger } = useChargerContext()

  const { data: analytics } = useSWR<AnalyticsResult>(
    ['charger.analytics', { chargerId: charger.id, days: 7 }],
    fetcher,
    { fallbackData: loaderData.analytics ?? undefined }
  )

  if (!analytics) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    )
  }

  const { daily, hourly, summary } = analytics
  const maxDailyKwh = Math.max(...daily.map((d) => Number(d.energyKwh)), 0.1)
  const maxHourlyPower = Math.max(...hourly.map((h) => Number(h.powerKw)), 0.1)
  const currentHour = new Date().getHours()

  const busiestDay =
    daily.length > 0
      ? [...daily].sort((a, b) => Number(b.energyKwh) - Number(a.energyKwh))[0]
      : null
  const busiestDayLabel = busiestDay
    ? dailyLabel(busiestDay.date, daily.indexOf(busiestDay), daily.length)
    : '—'

  return (
    <div className="flex flex-col gap-5">
      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              7-Day Total
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {Number(summary.totalKwh).toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kWh
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.totalSessions} sessions total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Sessions
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {summary.totalSessions}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              avg {Number(summary.avgSessionKwh).toFixed(1)} kWh/session
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Daily Average
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {Number(summary.avgDailyKwh).toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kWh
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Busiest: {busiestDayLabel}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Peak Power
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {Number(summary.peakPowerKw).toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                kW
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              of {charger.maxPowerKw} kW capacity
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Energy Chart (7 days) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Energy Delivered — Last 7 Days
            </h3>
          </div>
          <div className="mt-4 flex h-48 items-end gap-2">
            {daily.map((day, i) => {
              const label = dailyLabel(day.date, i, daily.length)
              const totalH =
                maxDailyKwh > 0
                  ? (Number(day.energyKwh) / maxDailyKwh) * 100
                  : 0

              return (
                <div
                  key={day.date}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                >
                  <div className="pointer-events-none absolute -top-20 left-1/2 z-10 hidden -translate-x-1/2 rounded-lg border bg-card px-3 py-2 text-[11px] shadow-lg group-hover:block">
                    <p className="font-semibold">{label}</p>
                    <p className="tabular-nums">
                      {day.energyKwh} kWh &middot; {day.sessions} sessions
                    </p>
                    <p className="text-muted-foreground tabular-nums">
                      Peak: {day.peakPowerKw} kW
                    </p>
                  </div>
                  <div
                    className="w-full overflow-hidden rounded-t-md bg-blue-500 transition-[height] duration-500"
                    style={{ height: `${Math.max(totalH, 2)}%` }}
                  />
                  <span className="mt-2 text-[10px] text-muted-foreground">
                    {label}
                  </span>
                  <span className="text-[10px] font-medium tabular-nums">
                    {day.energyKwh}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hourly Power Profile (Today) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Power Profile — Today</h3>
            <span className="text-xs text-muted-foreground">
              Average kW per hour
            </span>
          </div>
          <div className="mt-4 flex h-36 items-end gap-px">
            {hourly.map((h) => {
              const barH =
                maxHourlyPower > 0
                  ? (Number(h.powerKw) / maxHourlyPower) * 100
                  : 0
              const isCurrent = h.hour === currentHour
              const isFuture = h.hour > currentHour

              return (
                <div
                  key={h.hour}
                  className="group relative flex flex-1 flex-col items-center justify-end"
                >
                  <div className="pointer-events-none absolute -top-14 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 text-[10px] text-background shadow-lg group-hover:block">
                    <div className="font-medium">
                      {h.hour.toString().padStart(2, '0')}:00
                    </div>
                    <div>{h.powerKw} kW</div>
                    <div>{h.energyKwh} kWh</div>
                  </div>
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-[height] duration-300',
                      isFuture
                        ? 'bg-blue-100'
                        : isCurrent
                          ? 'bg-blue-600'
                          : 'bg-blue-400'
                    )}
                    style={{ height: `${Math.max(barH, 1)}%` }}
                  />
                  {h.hour % 4 === 0 && (
                    <span className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                      {h.hour.toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
