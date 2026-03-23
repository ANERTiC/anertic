import { useEffect, useState } from 'react'
import {
  RiSparklingLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLightbulbLine,
  RiArrowRightLine,
  RiTimeLine,
  RiLeafLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiSunLine,
  RiFlashlightLine,
  RiMoneyDollarCircleLine,
  RiFilterLine,
  RiLoader4Line,
  RiThunderstormsLine,
  RiLineChartLine,
  RiBarChartBoxLine,
  RiCalendarLine,
  RiBattery2ChargeLine,
  RiPlugLine,
  RiChargingPile2Line,
  RiArchiveDrawerLine,
  RiArrowRightSLine,
} from '@remixicon/react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

import { useSiteId } from '~/layouts/site'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'

// --- Types ---

type InsightType = 'warning' | 'opportunity' | 'achievement' | 'anomaly'
type InsightCategory = 'solar' | 'grid' | 'battery' | 'ev' | 'load' | 'cost'
type InsightStatus = 'new' | 'acknowledged' | 'resolved' | 'dismissed'

interface AIInsight {
  id: string
  type: InsightType
  category: InsightCategory
  status: InsightStatus
  title: string
  summary: string
  detail: string
  impact: string
  impactValue: number
  impactUnit: string
  action?: string
  confidence: number
  createdAt: string
}

interface DailySavings {
  date: string
  actual: number
  optimal: number
  grid: number
}

interface HourlyPattern {
  hour: number
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
  sun: number
}

interface AnomalyEvent {
  id: string
  timestamp: string
  metric: string
  expected: number
  actual: number
  deviation: number
  severity: 'low' | 'medium' | 'high'
  description: string
}

interface InsightsData {
  aiConfidence: number
  dailySummary: string
  totalConsumption30d: number
  prevConsumption30d: number
  co2AvoidedKg: number
  selfSufficiencyAvg: number
  insights: AIInsight[]
  savingsHistory: DailySavings[]
  weeklyPattern: HourlyPattern[]
  anomalies: AnomalyEvent[]
}

// --- Mock Data ---

function generateMockInsights(): InsightsData {
  const now = new Date()

  const savingsHistory: DailySavings[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (13 - i))
    const solar = 12 + Math.random() * 8
    const optimal = solar * 0.85 + Math.random() * 2
    const actual = optimal * (0.6 + Math.random() * 0.35)
    const grid = (solar - actual) * 0.4 + Math.random() * 3
    return {
      date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      actual: parseFloat(actual.toFixed(1)),
      optimal: parseFloat(optimal.toFixed(1)),
      grid: parseFloat(grid.toFixed(1)),
    }
  })

  const weeklyPattern: HourlyPattern[] = Array.from(
    { length: 24 },
    (_, hour) => {
      const base = 0.8
      const morningPeak = Math.exp(-((hour - 8) ** 2) / 8) * 3
      const eveningPeak = Math.exp(-((hour - 19) ** 2) / 6) * 4
      const solarDip = hour >= 10 && hour <= 15 ? -1.5 : 0
      const val = (h: number) =>
        parseFloat(
          Math.max(
            0.2,
            base +
              morningPeak +
              eveningPeak +
              solarDip +
              (Math.random() - 0.5) * h
          ).toFixed(1)
        )
      return {
        hour,
        mon: val(0.8),
        tue: val(0.7),
        wed: val(0.9),
        thu: val(0.6),
        fri: val(1.0),
        sat: val(1.2),
        sun: val(1.1),
      }
    }
  )

  return {
    aiConfidence: 87,
    dailySummary:
      'Your site is running 23% more efficiently than last week. Solar self-consumption improved after shifting EV charging to midday slots. Grid dependency dropped to its lowest in 30 days. I detect an opportunity to further reduce costs by pre-charging the battery before the evening TOU peak.',
    totalConsumption30d: 342.5,
    prevConsumption30d: 389.2,
    co2AvoidedKg: 186,
    selfSufficiencyAvg: 64,
    insights: [
      {
        id: 'ins-1',
        type: 'warning',
        category: 'ev',
        status: 'new',
        title: 'Charger CP-004 offline for 36 hours',
        summary:
          'No heartbeat since March 10, 08:14. Estimated daily revenue loss: 45 kWh.',
        detail:
          'CP-004 last communicated via OCPP heartbeat 36 hours ago. Based on historical usage, this charger serves 3-4 sessions/day averaging 12 kWh each. The firmware version 1.2.3 has a known watchdog timeout issue.',
        impact: '-45 kWh/day',
        impactValue: -45,
        impactUnit: 'kWh/day',
        action: 'Restart charger',
        confidence: 94,
        createdAt: new Date(Date.now() - 1200000).toISOString(),
      },
      {
        id: 'ins-2',
        type: 'opportunity',
        category: 'cost',
        status: 'new',
        title: 'Shift EV charging to solar peak window',
        summary:
          'Moving sessions to 11:00-15:00 could save 8.4 kWh/day in grid imports.',
        detail:
          'Analysis of 30 days of charging patterns shows 78% of sessions occur between 17:00-21:00 (TOU peak). Solar surplus during 11:00-15:00 averages 4.2 kW unused. Scheduling sessions during this window would eliminate grid cost for charging.',
        impact: '-12% grid cost',
        impactValue: -12,
        impactUnit: '% cost',
        action: 'Configure schedule',
        confidence: 88,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'ins-3',
        type: 'achievement',
        category: 'solar',
        status: 'new',
        title: 'Solar output 18% above 30-day average',
        summary:
          'Clear skies and optimal panel angle pushed production to 24.6 kWh today.',
        detail:
          "Today's solar generation exceeded the rolling 30-day average by 18%. This contributed to 68% self-sufficiency, up from 52% last week. Panel degradation is within normal range at 0.3% annual loss.",
        impact: '+18% output',
        impactValue: 18,
        impactUnit: '% output',
        confidence: 96,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'ins-4',
        type: 'opportunity',
        category: 'battery',
        status: 'acknowledged',
        title: 'Pre-charge battery before evening peak',
        summary:
          'Charging to 90% by 16:00 from solar surplus eliminates 18:00-21:00 grid dependency.',
        detail:
          'Battery SoC drops to 20% by 18:00 most evenings, forcing grid import during TOU peak. Pre-charging to 90% by 16:00 using excess solar (avg 2.8 kW surplus) would provide 7.2 kWh buffer for the peak window.',
        impact: '-3.2 kWh grid/day',
        impactValue: -3.2,
        impactUnit: 'kWh/day',
        action: 'Set battery schedule',
        confidence: 82,
        createdAt: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        id: 'ins-5',
        type: 'opportunity',
        category: 'load',
        status: 'new',
        title: 'HVAC consuming 40% more than predicted',
        summary:
          'Air conditioning load spiked due to thermostat setpoint change. Consider smart scheduling.',
        detail:
          'HVAC energy consumption increased 40% over the last 3 days after the thermostat was changed from 25°C to 22°C. Pre-cooling during solar hours and raising the setpoint by 1°C during peak would save 2.1 kWh/day.',
        impact: '-2.1 kWh/day',
        impactValue: -2.1,
        impactUnit: 'kWh/day',
        action: 'View HVAC settings',
        confidence: 76,
        createdAt: new Date(Date.now() - 28800000).toISOString(),
      },
      {
        id: 'ins-6',
        type: 'achievement',
        category: 'grid',
        status: 'resolved',
        title: 'Grid export earned 12.4 kWh credit',
        summary:
          'Excess solar exported during midday surplus. Net metering credit applied.',
        detail:
          'Between 11:00-14:00, 12.4 kWh was exported to the grid at the net metering rate. This offsets 6.2 baht in future grid imports.',
        impact: '+12.4 kWh credit',
        impactValue: 12.4,
        impactUnit: 'kWh',
        confidence: 99,
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
    anomalies: [
      {
        id: 'anom-1',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        metric: 'Grid import',
        expected: 1.2,
        actual: 3.8,
        deviation: 217,
        severity: 'high',
        description:
          'Grid import surged 3x expected — HVAC compressor cycling detected',
      },
      {
        id: 'anom-2',
        timestamp: new Date(Date.now() - 18000000).toISOString(),
        metric: 'Solar output',
        expected: 4.1,
        actual: 2.3,
        deviation: -44,
        severity: 'medium',
        description:
          'Solar output dropped 44% — cloud cover detected by weather API',
      },
      {
        id: 'anom-3',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        metric: 'Battery SoC',
        expected: 65,
        actual: 28,
        deviation: -57,
        severity: 'medium',
        description:
          'Battery drained faster than predicted — unscheduled EV session',
      },
    ],
    savingsHistory,
    weeklyPattern,
  }
}

// --- Helpers ---

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function insightTypeConfig(type: InsightType) {
  switch (type) {
    case 'warning':
      return {
        icon: RiAlertLine,
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        badge: 'bg-amber-500/15 text-amber-700',
        label: 'Warning',
      }
    case 'opportunity':
      return {
        icon: RiLightbulbLine,
        border: 'border-blue-500/30',
        bg: 'bg-blue-500/10',
        iconColor: 'text-blue-500',
        badge: 'bg-blue-500/15 text-blue-700',
        label: 'Opportunity',
      }
    case 'achievement':
      return {
        icon: RiCheckboxCircleLine,
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-500',
        badge: 'bg-emerald-500/15 text-emerald-700',
        label: 'Achievement',
      }
    case 'anomaly':
      return {
        icon: RiThunderstormsLine,
        border: 'border-red-500/30',
        bg: 'bg-red-500/10',
        iconColor: 'text-red-500',
        badge: 'bg-red-500/15 text-red-700',
        label: 'Anomaly',
      }
  }
}

function categoryIcon(cat: InsightCategory) {
  switch (cat) {
    case 'solar':
      return RiSunLine
    case 'grid':
      return RiPlugLine
    case 'battery':
      return RiBattery2ChargeLine
    case 'ev':
      return RiChargingPile2Line
    case 'load':
      return RiFlashlightLine
    case 'cost':
      return RiMoneyDollarCircleLine
  }
}

function categoryColor(cat: InsightCategory) {
  switch (cat) {
    case 'solar':
      return 'text-amber-500'
    case 'grid':
      return 'text-blue-500'
    case 'battery':
      return 'text-emerald-500'
    case 'ev':
      return 'text-cyan-500'
    case 'load':
      return 'text-violet-500'
    case 'cost':
      return 'text-rose-500'
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case 'high':
      return { bg: 'bg-red-500/10', text: 'text-red-600', dot: 'bg-red-500' }
    case 'medium':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-600',
        dot: 'bg-amber-500',
      }
    default:
      return { bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500' }
  }
}

// --- Custom Tooltip ---

function SavingsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground capitalize">
            {entry.dataKey}
          </span>
          <span className="ml-auto font-medium tabular-nums">
            {entry.value} kWh
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Main Component ---

export default function Insights() {
  const siteId = useSiteId()
  const [mounted, setMounted] = useState(false)
  const [activeFilter, setActiveFilter] = useState<InsightType | 'all'>('all')
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const [data] = useState<InsightsData>(() => generateMockInsights())

  const filteredInsights =
    activeFilter === 'all'
      ? data.insights
      : data.insights.filter((i) => i.type === activeFilter)

  const newCount = data.insights.filter((i) => i.status === 'new').length
  const consumptionChange =
    data.prevConsumption30d > 0
      ? ((data.totalConsumption30d - data.prevConsumption30d) /
          data.prevConsumption30d) *
        100
      : 0
  const consumptionImproved = consumptionChange <= 0

  // Heatmap color intensity
  const allHeatValues = data.weeklyPattern.flatMap((h) => [
    h.mon,
    h.tue,
    h.wed,
    h.thu,
    h.fri,
    h.sat,
    h.sun,
  ])
  const maxHeat = Math.max(...allHeatValues)

  return (
    <div
      className={cn(
        'space-y-6 transition-opacity duration-500',
        mounted ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Insights
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <RiSparklingLine className="size-3.5 text-amber-500" />
            AI-powered energy intelligence
            {newCount > 0 && (
              <Badge variant="secondary" className="ml-1 gap-1 text-[10px]">
                {newCount} new
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════
          AI PULSE — Confidence + Summary
          ═══════════════════════════════ */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 via-background to-primary/5">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-32 size-96 rounded-full bg-amber-500/[0.03] blur-3xl" />
          <div className="absolute -bottom-40 -left-32 size-[30rem] rounded-full bg-blue-500/[0.03] blur-3xl" />
        </div>

        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            {/* Confidence Ring */}
            <div className="flex flex-col items-center lg:shrink-0">
              <div className="flex items-center gap-2">
                <RiSparklingLine className="size-4 text-amber-500" />
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  AI Confidence
                </span>
              </div>
              <div className="relative mt-3">
                <ConfidenceRing value={data.aiConfidence} size={160} />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground/60">
                Based on 30 days of data
              </p>
            </div>

            {/* Summary + Stats */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-orange-600">
                  <RiSparklingLine className="size-3 text-white" />
                </div>
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Daily Intelligence
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                {data.dailySummary}
              </p>

              {/* Key stats row */}
              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <PulseStat
                  icon={RiMoneyDollarCircleLine}
                  label="Grid consumption"
                  value={`${data.totalConsumption30d.toFixed(0)} kWh`}
                  sub={`${consumptionChange > 0 ? '+' : ''}${consumptionChange.toFixed(1)}% vs prev 30d`}
                  color={
                    consumptionImproved ? 'text-emerald-500' : 'text-red-500'
                  }
                />
                <PulseStat
                  icon={RiLeafLine}
                  label="CO₂ avoided"
                  value={`${data.co2AvoidedKg} kg`}
                  sub="this month"
                  color="text-teal-500"
                />
                <PulseStat
                  icon={RiSunLine}
                  label="Self-sufficiency"
                  value={`${data.selfSufficiencyAvg}%`}
                  sub="30-day average"
                  color="text-amber-500"
                />
                <PulseStat
                  icon={RiLineChartLine}
                  label="Insights generated"
                  value={`${data.insights.length}`}
                  sub={`${newCount} actionable`}
                  color="text-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 30-day comparison */}
          <div className="mt-6 border-t border-border/50 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Grid consumption — 30 day comparison
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums',
                  consumptionImproved
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-red-500/10 text-red-600'
                )}
              >
                {consumptionImproved ? (
                  <RiArrowDownSLine className="size-3.5" />
                ) : (
                  <RiArrowUpSLine className="size-3.5" />
                )}
                {Math.abs(consumptionChange).toFixed(1)}%
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {/* Current period */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-right text-[11px] text-foreground/80 tabular-nums">
                  {data.totalConsumption30d.toFixed(0)}{' '}
                  <span className="text-muted-foreground/50">kWh</span>
                </span>
                <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted/60">
                  <div
                    className={cn(
                      'h-full rounded transition-all duration-1000 ease-out',
                      consumptionImproved ? 'bg-emerald-500' : 'bg-red-400'
                    )}
                    style={{
                      width: `${Math.min(100, (data.totalConsumption30d / Math.max(data.totalConsumption30d, data.prevConsumption30d)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-[10px] font-medium text-muted-foreground/60">
                  Current
                </span>
              </div>

              {/* Previous period */}
              <div className="flex items-center gap-3">
                <span className="w-20 text-right text-[11px] text-muted-foreground/60 tabular-nums">
                  {data.prevConsumption30d.toFixed(0)}{' '}
                  <span className="text-muted-foreground/40">kWh</span>
                </span>
                <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted/60">
                  <div
                    className="h-full rounded bg-foreground/10 transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(100, (data.prevConsumption30d / Math.max(data.totalConsumption30d, data.prevConsumption30d)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-[10px] text-muted-foreground/40">
                  Prev 30d
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════
          COST OPTIMIZATION CHART
          ═══════════════════════ */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-border/50 p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Energy Optimization</h3>
              <p className="text-xs text-muted-foreground">
                Actual vs optimal solar self-consumption
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500/30" />
                Optimal
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-400" />
                Grid
              </span>
            </div>
          </div>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.savingsHistory}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradOptimal" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.72 0.17 163)"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.72 0.17 163)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.72 0.17 163)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.72 0.17 163)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  <linearGradient id="gradGrid" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="oklch(0.7 0.12 250)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="oklch(0.7 0.12 250)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="oklch(0.7 0 0)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="oklch(0.7 0 0)"
                  unit=" kWh"
                />
                <RechartsTooltip content={<SavingsTooltip />} />
                <Area
                  type="monotone"
                  dataKey="optimal"
                  stroke="oklch(0.72 0.17 163 / 0.4)"
                  fill="url(#gradOptimal)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="oklch(0.72 0.17 163)"
                  fill="url(#gradActual)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="grid"
                  stroke="oklch(0.7 0.12 250)"
                  fill="url(#gradGrid)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly consumption heatmap */}
        <div className="rounded-xl border border-border/50 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Consumption Patterns</h3>
              <p className="text-xs text-muted-foreground">
                7-day hourly heatmap (kWh)
              </p>
            </div>
            <RiBarChartBoxLine className="size-4 text-muted-foreground/40" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[280px]">
              {/* Day headers */}
              <div className="mb-1 grid grid-cols-[32px_repeat(7,1fr)] gap-0.5 text-center">
                <span />
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <span
                    key={d}
                    className="text-[9px] font-medium text-muted-foreground/60"
                  >
                    {d}
                  </span>
                ))}
              </div>
              {/* Heatmap rows — show every 2 hours */}
              {data.weeklyPattern
                .filter((_, i) => i % 2 === 0)
                .map((row) => {
                  const days = [
                    row.mon,
                    row.tue,
                    row.wed,
                    row.thu,
                    row.fri,
                    row.sat,
                    row.sun,
                  ]
                  return (
                    <div
                      key={row.hour}
                      className="grid grid-cols-[32px_repeat(7,1fr)] gap-0.5"
                    >
                      <span className="flex items-center text-[9px] text-muted-foreground/50 tabular-nums">
                        {row.hour.toString().padStart(2, '0')}
                      </span>
                      {days.map((val, di) => {
                        const intensity = maxHeat > 0 ? val / maxHeat : 0
                        return (
                          <div
                            key={di}
                            className="group relative flex aspect-[2/1] items-center justify-center rounded-sm"
                            style={{
                              backgroundColor: `oklch(0.72 0.17 163 / ${(intensity * 0.7 + 0.05).toFixed(2)})`,
                            }}
                          >
                            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[9px] whitespace-nowrap text-background shadow group-hover:block">
                              {val} kWh
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              {/* Legend */}
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <span className="text-[9px] text-muted-foreground/50">Low</span>
                {[0.1, 0.25, 0.45, 0.65, 0.85].map((opacity) => (
                  <div
                    key={opacity}
                    className="size-2.5 rounded-sm"
                    style={{
                      backgroundColor: `oklch(0.72 0.17 163 / ${opacity})`,
                    }}
                  />
                ))}
                <span className="text-[9px] text-muted-foreground/50">
                  High
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════
          INSIGHT FEED
          ═══════════════════ */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Insight Feed
            </h2>
            <Badge variant="secondary" className="text-[10px]">
              {filteredInsights.length}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'warning', 'opportunity', 'achievement'] as const).map(
              (filter) => {
                const isActive = activeFilter === filter
                return (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-all',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {filter === 'all'
                      ? 'All'
                      : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                )
              }
            )}
          </div>
        </div>

        <div className="space-y-3">
          {filteredInsights.map((insight) => {
            const config = insightTypeConfig(insight.type)
            const Icon = config.icon
            const CatIcon = categoryIcon(insight.category)
            const isExpanded = expandedInsight === insight.id

            return (
              <div
                key={insight.id}
                className={cn(
                  'group rounded-xl border transition-all',
                  config.border,
                  isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'
                )}
              >
                <button
                  onClick={() =>
                    setExpandedInsight(isExpanded ? null : insight.id)
                  }
                  className="flex w-full items-start gap-3 p-4 text-left sm:gap-4"
                >
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10',
                      config.bg
                    )}
                  >
                    <Icon
                      className={cn('size-4 sm:size-5', config.iconColor)}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{insight.title}</p>
                          {insight.status === 'new' && (
                            <span className="size-1.5 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {insight.summary}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        {insight.impact && (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold',
                              config.badge
                            )}
                          >
                            {insight.impact}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                          <CatIcon
                            className={cn(
                              'size-3',
                              categoryColor(insight.category)
                            )}
                          />
                          <RiTimeLine className="size-3" />
                          {timeAgo(insight.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <RiArrowRightSLine
                    className={cn(
                      'mt-2 size-4 shrink-0 text-muted-foreground/30 transition-transform',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 pt-3 pb-4 sm:pl-[4.5rem]">
                    <p className="text-xs leading-relaxed text-foreground/70">
                      {insight.detail}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <RiSparklingLine className="size-3" />
                        {insight.confidence}% confidence
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <CatIcon
                          className={cn(
                            'size-3',
                            categoryColor(insight.category)
                          )}
                        />
                        {insight.category}
                      </Badge>
                      {insight.status !== 'new' && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] capitalize"
                        >
                          {insight.status}
                        </Badge>
                      )}
                    </div>
                    {insight.action && (
                      <button className="mt-3 flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90">
                        {insight.action}
                        <RiArrowRightLine className="size-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════
          ANOMALY DETECTION
          ═══════════════════════ */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiThunderstormsLine className="size-4 text-muted-foreground/60" />
              <h3 className="text-sm font-medium">Anomaly Detection</h3>
              <Badge variant="secondary" className="text-[10px]">
                {data.anomalies.length}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground/50">
              Last 7 days
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {data.anomalies.map((anomaly) => {
              const sev = severityColor(anomaly.severity)
              return (
                <div
                  key={anomaly.id}
                  className="flex items-start gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/30"
                >
                  <div className="mt-0.5 flex flex-col items-center gap-1">
                    <span className={cn('size-2 rounded-full', sev.dot)} />
                    <span className="h-full w-px bg-border/50" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium">
                        {anomaly.description}
                      </p>
                      <Badge
                        className={cn('shrink-0 text-[10px]', sev.bg, sev.text)}
                      >
                        {anomaly.deviation > 0 ? '+' : ''}
                        {anomaly.deviation}%
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                      <span className="tabular-nums">
                        {timeAgo(anomaly.timestamp)}
                      </span>
                      <span>
                        Expected:{' '}
                        <strong className="text-foreground/50">
                          {anomaly.expected}
                        </strong>
                      </span>
                      <span>
                        Actual:{' '}
                        <strong className={sev.text}>{anomaly.actual}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Sub-components ---

function ConfidenceRing({ value, size }: { value: number; size: number }) {
  const strokeWidth = 12
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const filled = (value / 100) * circumference
  const gap = circumference - filled

  const strokeColor =
    value >= 80
      ? 'stroke-emerald-500'
      : value >= 60
        ? 'stroke-amber-500'
        : 'stroke-red-500'
  const trackColor =
    value >= 80
      ? 'stroke-emerald-500/15'
      : value >= 60
        ? 'stroke-amber-500/15'
        : 'stroke-red-500/15'
  const textColor =
    value >= 80
      ? 'text-emerald-500'
      : value >= 60
        ? 'text-amber-500'
        : 'text-red-500'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${gap}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold tabular-nums', textColor)}>
          {value}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          confidence
        </span>
      </div>
    </div>
  )
}

function PulseStat({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof RiSunLine
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('size-3', color)} />
        <span className="text-[10px] text-muted-foreground/60">{label}</span>
      </div>
      <p className={cn('mt-1 text-sm font-semibold tabular-nums', color)}>
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground/50">{sub}</p>
    </div>
  )
}
