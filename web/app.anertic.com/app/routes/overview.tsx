import { useEffect, useState } from "react"
import {
  RiSunLine,
  RiPlugLine,
  RiFlashlightLine,
  RiBattery2ChargeLine,
  RiChargingPile2Line,
  RiCpuLine,
  RiArrowRightSLine,
  RiSignalWifiLine,
  RiSignalWifiOffLine,
  RiSparklingLine,
  RiTempColdLine,
  RiDropLine,
  RiEyeLine,
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLightbulbLine,
  RiArrowRightLine,
  RiTimeLine,
  RiLeafLine,
  RiArrowUpSLine,
  RiArrowDownSLine,
} from "@remixicon/react"
import { useNavigate } from "react-router"

import { useSiteId } from "~/layouts/site"
import { Card, CardContent } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

// --- Types ---

interface SiteOverview {
  siteName: string
  timezone: string
  // AI Score
  energyScore: number
  scoreChange: number
  scoreTrend: "up" | "down" | "stable"
  aiSummary: string
  // Power (real-time kW)
  solarPowerKw: number
  gridPowerKw: number
  consumptionPowerKw: number
  batteryPowerKw: number
  batterySoc: number
  // Energy (today kWh)
  todaySolarKwh: number
  todayGridKwh: number
  todayConsumptionKwh: number
  todayExportKwh: number
  todayChargeKwh: number
  // Devices
  totalDevices: number
  onlineDevices: number
  totalChargers: number
  activeChargers: number
  // Weather
  weatherTemp: number | null
  weatherHumidity: number | null
  weatherCondition: string | null
  // Data
  chargers: ChargerStatus[]
  insights: Insight[]
  hourlyEnergy: HourlyEnergy[]
}

interface ChargerStatus {
  id: string
  chargePointId: string
  status: string
  currentPowerKw: number
  sessionEnergyKwh: number
  lastHeartbeatAt: string | null
}

interface Insight {
  id: string
  type: "info" | "warning" | "success"
  priority: "high" | "medium" | "low"
  title: string
  message: string
  action?: string
  impact?: string
  createdAt: string
}

interface HourlyEnergy {
  hour: number
  solarKwh: number
  gridKwh: number
  consumptionKwh: number
}

// --- Mock Data ---

function generateMockData(): SiteOverview {
  const currentHour = new Date().getHours()

  const hourlyEnergy: HourlyEnergy[] = Array.from({ length: 24 }, (_, hour) => {
    const solarBase = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
    const solar = hour >= 6 && hour <= 18 ? solarBase * 4.2 + Math.random() * 0.5 : 0
    const morningPeak = Math.exp(-((hour - 8) ** 2) / 8)
    const eveningPeak = Math.exp(-((hour - 19) ** 2) / 8)
    const baseLoad = 0.8
    const consumption = baseLoad + morningPeak * 2.5 + eveningPeak * 3.2 + Math.random() * 0.3
    const grid = Math.max(0, consumption - solar)
    return {
      hour,
      solarKwh: hour <= currentHour ? parseFloat(solar.toFixed(2)) : 0,
      gridKwh: hour <= currentHour ? parseFloat(grid.toFixed(2)) : 0,
      consumptionKwh: hour <= currentHour ? parseFloat(consumption.toFixed(2)) : 0,
    }
  })

  const todaySolarKwh = hourlyEnergy.reduce((s, h) => s + h.solarKwh, 0)
  const todayGridKwh = hourlyEnergy.reduce((s, h) => s + h.gridKwh, 0)
  const todayConsumptionKwh = hourlyEnergy.reduce((s, h) => s + h.consumptionKwh, 0)

  return {
    siteName: "Bangkok HQ",
    timezone: "Asia/Bangkok",
    energyScore: 78,
    scoreChange: 6,
    scoreTrend: "up",
    aiSummary:
      "Your site is performing well today. Solar production is 18% above the 30-day average, driving self-sufficiency to 68%. However, charger CP-004 has been offline for 24 hours — estimated 45 kWh/day revenue loss. I recommend shifting EV charging to the 13:00–15:00 solar peak to cut grid costs by 12%.",
    solarPowerKw: 3.42,
    gridPowerKw: 1.18,
    consumptionPowerKw: 4.27,
    batteryPowerKw: -0.33,
    batterySoc: 72,
    todaySolarKwh: parseFloat(todaySolarKwh.toFixed(1)),
    todayGridKwh: parseFloat(todayGridKwh.toFixed(1)),
    todayConsumptionKwh: parseFloat(todayConsumptionKwh.toFixed(1)),
    todayExportKwh: 2.4,
    todayChargeKwh: 8.7,
    totalDevices: 12,
    onlineDevices: 10,
    totalChargers: 4,
    activeChargers: 2,
    weatherTemp: 32,
    weatherHumidity: 68,
    weatherCondition: "Partly cloudy",
    chargers: [
      {
        id: "chr-1",
        chargePointId: "CP-001",
        status: "Charging",
        currentPowerKw: 7.2,
        sessionEnergyKwh: 14.3,
        lastHeartbeatAt: new Date(Date.now() - 30000).toISOString(),
      },
      {
        id: "chr-2",
        chargePointId: "CP-002",
        status: "Charging",
        currentPowerKw: 11.0,
        sessionEnergyKwh: 6.8,
        lastHeartbeatAt: new Date(Date.now() - 15000).toISOString(),
      },
      {
        id: "chr-3",
        chargePointId: "CP-003",
        status: "Available",
        currentPowerKw: 0,
        sessionEnergyKwh: 0,
        lastHeartbeatAt: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: "chr-4",
        chargePointId: "CP-004",
        status: "Faulted",
        currentPowerKw: 0,
        sessionEnergyKwh: 0,
        lastHeartbeatAt: null,
      },
    ],
    insights: [
      {
        id: "ins-1",
        type: "warning",
        priority: "high",
        title: "CP-004 offline for 24h",
        message:
          "Charger CP-004 hasn't sent a heartbeat since yesterday. Estimated revenue loss: 45 kWh/day.",
        action: "View charger",
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "ins-2",
        type: "info",
        priority: "high",
        title: "Shift EV charging to solar peak",
        message:
          "Moving CP-001 and CP-002 sessions to 13:00–15:00 would reduce grid import by 8.4 kWh/day.",
        action: "Schedule charging",
        impact: "-12% grid cost",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "ins-3",
        type: "success",
        priority: "medium",
        title: "Solar output above average",
        message:
          "Production is 18% higher than the 30-day average. Self-sufficiency reached 68%, up from 52% last week.",
        impact: "+18% output",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "ins-4",
        type: "info",
        priority: "medium",
        title: "Battery cycle optimization",
        message:
          "Pre-charge battery to 90% by 16:00 from solar surplus to eliminate grid dependency during 18:00–21:00 peak.",
        impact: "-3.2 kWh grid/day",
        createdAt: new Date(Date.now() - 14400000).toISOString(),
      },
    ],
    hourlyEnergy,
  }
}

// --- Helpers ---

function formatPower(kw: number): string {
  if (kw >= 1000) return `${(kw / 1000).toFixed(1)} MW`
  if (kw >= 100) return `${Math.round(kw)} kW`
  if (kw >= 10) return `${kw.toFixed(1)} kW`
  return `${kw.toFixed(2)} kW`
}

function formatEnergy(kwh: number): string {
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(1)} MWh`
  if (kwh >= 100) return `${Math.round(kwh)} kWh`
  return `${kwh.toFixed(1)} kWh`
}

function chargerStatusColor(status: string) {
  switch (status) {
    case "Available":
      return "bg-emerald-500/15 text-emerald-700"
    case "Charging":
    case "Preparing":
      return "bg-blue-500/15 text-blue-700"
    case "SuspendedEV":
    case "SuspendedEVSE":
    case "Finishing":
      return "bg-amber-500/15 text-amber-700"
    case "Faulted":
      return "bg-red-500/15 text-red-700"
    default:
      return "bg-gray-500/15 text-gray-700"
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

function insightIcon(type: string) {
  switch (type) {
    case "warning":
      return RiAlertLine
    case "success":
      return RiCheckboxCircleLine
    default:
      return RiLightbulbLine
  }
}

function insightAccent(type: string) {
  switch (type) {
    case "warning":
      return {
        border: "border-amber-500/30",
        bg: "bg-amber-500/10",
        icon: "text-amber-500",
        badge: "bg-amber-500/15 text-amber-700",
      }
    case "success":
      return {
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/10",
        icon: "text-emerald-500",
        badge: "bg-emerald-500/15 text-emerald-700",
      }
    default:
      return {
        border: "border-blue-500/30",
        bg: "bg-blue-500/10",
        icon: "text-blue-500",
        badge: "bg-blue-500/15 text-blue-700",
      }
  }
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-500"
  if (score >= 60) return "text-amber-500"
  return "text-red-500"
}

function scoreStroke(score: number) {
  if (score >= 80) return "stroke-emerald-500"
  if (score >= 60) return "stroke-amber-500"
  return "stroke-red-500"
}

function scoreTrack(score: number) {
  if (score >= 80) return "stroke-emerald-500/15"
  if (score >= 60) return "stroke-amber-500/15"
  return "stroke-red-500/15"
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent"
  if (score >= 80) return "Great"
  if (score >= 70) return "Good"
  if (score >= 60) return "Fair"
  if (score >= 50) return "Needs work"
  return "Poor"
}

// --- Main Component ---

export default function Overview() {
  const siteId = useSiteId()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // TODO: Replace with API call when backend is ready
  // const { data } = useSWR(["site.overview", siteId], () => api<SiteOverview>("site.overview", { siteId }), { refreshInterval: 15000 })
  const [data] = useState<SiteOverview>(() => generateMockData())

  const currentHour = new Date().getHours()

  const totalTodayKwh = data.todaySolarKwh + data.todayGridKwh
  const solarPercent = totalTodayKwh > 0 ? (data.todaySolarKwh / totalTodayKwh) * 100 : 0
  const selfSufficiency =
    data.todayConsumptionKwh > 0
      ? Math.min(100, (data.todaySolarKwh / data.todayConsumptionKwh) * 100)
      : 0

  const maxHourlyValue = Math.max(
    ...data.hourlyEnergy.map((h) => Math.max(h.solarKwh, h.consumptionKwh, 0.1)),
  )

  const highPriorityInsights = data.insights.filter((i) => i.priority === "high")
  const otherInsights = data.insights.filter((i) => i.priority !== "high")

  return (
    <div
      className={cn(
        "space-y-6 transition-opacity duration-500",
        mounted ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{data.siteName || "Overview"}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
            {data.timezone && (
              <>
                <span className="text-border">|</span>
                {data.timezone}
              </>
            )}
          </p>
        </div>
        {data.weatherTemp !== null && (
          <div className="flex items-center gap-3 self-start rounded-lg border bg-card px-3 py-2 text-xs sm:gap-4 sm:px-4 sm:py-2.5 sm:text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <RiTempColdLine className="size-3.5 sm:size-4" />
              <span className="font-medium text-foreground">{data.weatherTemp}°C</span>
            </div>
            {data.weatherHumidity !== null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <RiDropLine className="size-3 sm:size-3.5" />
                <span>{data.weatherHumidity}%</span>
              </div>
            )}
            <span className="hidden text-xs text-muted-foreground sm:inline">{data.weatherCondition}</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          AI HERO — Energy Score + Summary + Actions
          ═══════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 via-background to-primary/5">
        {/* Background atmosphere */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 size-96 rounded-full bg-amber-500/[0.03] blur-3xl" />
          <div className="absolute -bottom-40 -left-32 size-[30rem] rounded-full bg-blue-500/[0.03] blur-3xl" />
          <div className="absolute right-1/4 top-1/3 size-64 rounded-full bg-emerald-500/[0.02] blur-3xl" />
        </div>

        <div className="relative p-6 lg:p-8">
          {/* Top row: Score + Summary */}
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            {/* Energy Score */}
            <div className="flex flex-col items-center lg:shrink-0">
              <div className="flex items-center gap-2">
                <RiSparklingLine className="size-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Energy Score
                </span>
              </div>
              <div className="relative mt-3">
                <ScoreRing score={data.energyScore} size={160} strokeWidth={12} />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {data.scoreTrend === "up" ? (
                  <RiArrowUpSLine className="size-4 text-emerald-400" />
                ) : data.scoreTrend === "down" ? (
                  <RiArrowDownSLine className="size-4 text-red-400" />
                ) : null}
                <span
                  className={cn(
                    "text-xs font-medium",
                    data.scoreTrend === "up"
                      ? "text-emerald-400"
                      : data.scoreTrend === "down"
                        ? "text-red-400"
                        : "text-muted-foreground",
                  )}
                >
                  {data.scoreChange > 0 ? "+" : ""}
                  {data.scoreChange} pts from yesterday
                </span>
              </div>
            </div>

            {/* AI Summary + Key Metrics */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-500 to-orange-600">
                  <RiSparklingLine className="size-3 text-white" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Analysis
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground/70">{data.aiSummary}</p>

              {/* Key metrics row */}
              <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricPill
                  icon={RiLeafLine}
                  label="Self-sufficiency"
                  value={`${selfSufficiency.toFixed(0)}%`}
                  color="text-emerald-400"
                />
                <MetricPill
                  icon={RiSunLine}
                  label="Solar today"
                  value={formatEnergy(data.todaySolarKwh)}
                  color="text-amber-400"
                />
                <MetricPill
                  icon={RiPlugLine}
                  label="Grid import"
                  value={formatEnergy(data.todayGridKwh)}
                  color="text-blue-400"
                />
                <MetricPill
                  icon={RiChargingPile2Line}
                  label="EV charged"
                  value={formatEnergy(data.todayChargeKwh)}
                  color="text-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* High-priority actions */}
          {highPriorityInsights.length > 0 && (
            <div className="mt-6 border-t border-border/50 pt-6">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Requires attention
              </span>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {highPriorityInsights.map((insight) => {
                  const Icon = insightIcon(insight.type)
                  const accent = insightAccent(insight.type)

                  return (
                    <div
                      key={insight.id}
                      className={cn(
                        "group cursor-pointer rounded-lg border p-4 transition-all hover:bg-muted/50",
                        accent.border,
                      )}
                    >
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            accent.bg,
                          )}
                        >
                          <Icon className={cn("size-4", accent.icon)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{insight.title}</p>
                            {insight.impact && (
                              <span
                                className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                  accent.badge,
                                )}
                              >
                                {insight.impact}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {insight.message}
                          </p>
                          {insight.action && (
                            <button className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-foreground/70 transition-colors group-hover:text-foreground">
                              {insight.action}
                              <RiArrowRightLine className="size-3 transition-transform group-hover:translate-x-0.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* More insights */}
      {otherInsights.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {otherInsights.map((insight) => {
            const Icon = insightIcon(insight.type)
            const accent = insightAccent(insight.type)

            return (
              <Card key={insight.id} className="group cursor-pointer py-0 transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        accent.bg,
                      )}
                    >
                      <Icon className={cn("size-4", accent.icon)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{insight.title}</p>
                        {insight.impact && (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                              accent.badge,
                            )}
                          >
                            {insight.impact}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {insight.message}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <RiTimeLine className="size-3" />
                          {timeAgo(insight.createdAt)}
                        </span>
                        {insight.action && (
                          <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                            {insight.action}
                            <RiArrowRightLine className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════
          Supporting Data Below
          ═══════════════════════ */}

      {/* Live Power Strip — Desktop */}
      <Card className="hidden overflow-hidden py-0 md:block">
        <CardContent className="p-0">
          <div className="grid grid-cols-5 divide-x">
            <PowerCell icon={RiSunLine} label="Solar" kw={data.solarPowerKw} kwh={data.todaySolarKwh} color="amber" />
            <PowerCell icon={RiBattery2ChargeLine} label="Battery" kw={data.batteryPowerKw} soc={data.batterySoc} color="emerald" />
            <PowerCell icon={RiFlashlightLine} label="Load" kw={data.consumptionPowerKw} kwh={data.todayConsumptionKwh} color="violet" />
            <PowerCell icon={RiPlugLine} label="Grid" kw={data.gridPowerKw} kwh={data.todayGridKwh} color="blue" />
            <PowerCell
              icon={RiChargingPile2Line}
              label="EV"
              kw={data.chargers.filter((c) => c.status === "Charging").reduce((s, c) => s + c.currentPowerKw, 0)}
              kwh={data.todayChargeKwh}
              color="cyan"
            />
          </div>
        </CardContent>
      </Card>

      {/* Live Energy Flow — Mobile */}
      <Card className="overflow-hidden py-0 md:hidden">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Energy Flow
            </span>
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="space-y-1 p-4">
            <div className="px-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Sources
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FlowNode icon={RiSunLine} label="Solar" value={formatPower(data.solarPowerKw)} sub={`${formatEnergy(data.todaySolarKwh)} today`} color="amber" />
              <FlowNode icon={RiPlugLine} label="Grid" value={formatPower(data.gridPowerKw)} sub={`${formatEnergy(data.todayGridKwh)} today`} color="blue" />
            </div>

            <div className="flex justify-center py-0.5">
              <div className="energy-flow-line h-6" />
            </div>

            <div className="flex justify-center">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2.5">
                <RiBattery2ChargeLine className="size-5 text-emerald-600" />
                <div>
                  <p className="text-base font-bold tabular-nums text-emerald-700">{data.batterySoc}%</p>
                  <p className="text-[10px] text-emerald-600/70">
                    {data.batteryPowerKw > 0 ? "+" : ""}
                    {formatPower(data.batteryPowerKw)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center py-0.5">
              <div className="energy-flow-line h-6" />
            </div>

            <div className="px-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Consumption
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FlowNode icon={RiFlashlightLine} label="Load" value={formatPower(data.consumptionPowerKw)} sub={`${formatEnergy(data.todayConsumptionKwh)} today`} color="violet" />
              <FlowNode
                icon={RiChargingPile2Line}
                label="EV"
                value={formatPower(data.chargers.filter((c) => c.status === "Charging").reduce((s, c) => s + c.currentPowerKw, 0))}
                sub={`${formatEnergy(data.todayChargeKwh)} today`}
                color="cyan"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Energy Mix + Timeline */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="py-0">
          <CardContent className="p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Energy Mix</h3>
            <div className="mt-4 flex items-center justify-center">
              <EnergyRing solarPercent={solarPercent} totalKwh={totalTodayKwh} selfSufficiency={selfSufficiency} />
            </div>
            <div className="mt-5 space-y-2.5">
              <EnergyMixRow color="bg-amber-500" label="Solar" value={data.todaySolarKwh} percent={solarPercent} />
              <EnergyMixRow color="bg-blue-500" label="Grid" value={data.todayGridKwh} percent={100 - solarPercent} />
              {data.todayExportKwh > 0 && (
                <div className="flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
                  <span>Exported</span>
                  <span className="font-medium text-emerald-600">+{formatEnergy(data.todayExportKwh)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="py-0 lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Today's Energy</h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-500" />
                  Solar
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-violet-500" />
                  Consumption
                </span>
              </div>
            </div>
            <div className="mt-4 flex h-40 items-end gap-px">
              {Array.from({ length: 24 }, (_, hour) => {
                const entry = data.hourlyEnergy.find((h) => h.hour === hour)
                const solar = entry?.solarKwh ?? 0
                const consumption = entry?.consumptionKwh ?? 0
                const solarH = maxHourlyValue > 0 ? (solar / maxHourlyValue) * 100 : 0
                const consH = maxHourlyValue > 0 ? (consumption / maxHourlyValue) * 100 : 0
                const isCurrent = hour === currentHour
                const isFuture = hour > currentHour

                return (
                  <div key={hour} className="group relative flex flex-1 flex-col items-center justify-end">
                    <div className="pointer-events-none absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 text-[10px] text-background shadow-lg group-hover:block">
                      <div className="font-medium">{hour.toString().padStart(2, "0")}:00</div>
                      <div className="text-amber-300">{solar.toFixed(1)} kWh</div>
                      <div className="text-violet-300">{consumption.toFixed(1)} kWh</div>
                    </div>
                    <div className="flex w-full gap-px">
                      <div
                        className={cn("flex-1 rounded-t-sm", isFuture ? "bg-amber-200/40" : "bg-amber-400", isCurrent && "bg-amber-500")}
                        style={{ height: `${Math.max(solarH, 1)}%` }}
                      />
                      <div
                        className={cn("flex-1 rounded-t-sm", isFuture ? "bg-violet-200/40" : "bg-violet-400", isCurrent && "bg-violet-500")}
                        style={{ height: `${Math.max(consH, 1)}%` }}
                      />
                    </div>
                    {hour % 4 === 0 && (
                      <span className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
                        {hour.toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chargers + Devices */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Chargers</h3>
            <button
              onClick={() => navigate(`/chargers?site=${siteId}`)}
              className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <RiArrowRightSLine className="size-3.5" />
            </button>
          </div>
          {data.chargers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <RiChargingPile2Line className="size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">No chargers registered</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.chargers.slice(0, 4).map((charger) => (
                <Card
                  key={charger.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => navigate(`/chargers/${charger.id}?site=${siteId}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{charger.chargePointId}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          {charger.lastHeartbeatAt ? (
                            <RiSignalWifiLine className="size-3 text-emerald-500" />
                          ) : (
                            <RiSignalWifiOffLine className="size-3 text-red-400" />
                          )}
                          {timeAgo(charger.lastHeartbeatAt)}
                        </div>
                      </div>
                      <Badge className={chargerStatusColor(charger.status)}>{charger.status}</Badge>
                    </div>
                    {charger.status === "Charging" && (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Power</span>
                          <span className="font-medium tabular-nums">{formatPower(charger.currentPowerKw)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.min(100, (charger.currentPowerKw / 22) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Session</span>
                          <span className="tabular-nums">{charger.sessionEnergyKwh.toFixed(1)} kWh</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="flex h-full flex-col py-0">
          <CardContent className="flex flex-1 flex-col p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Devices</h3>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-violet-50">
                <RiCpuLine className="size-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  {data.onlineDevices}
                  <span className="text-base font-normal text-muted-foreground">/{data.totalDevices}</span>
                </p>
                <p className="text-xs text-muted-foreground">online</p>
              </div>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => navigate(`/devices?site=${siteId}`)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <RiEyeLine className="size-3" />
              View devices
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// --- Sub-components ---

function ScoreRing({ score, size, strokeWidth }: { score: number; size: number; strokeWidth: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const gap = circumference - filled

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={scoreTrack(score)}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={scoreStroke(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={`${filled} ${gap}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold tabular-nums", scoreColor(score))}>{score}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{scoreLabel(score)}</span>
      </div>
    </div>
  )
}

function MetricPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof RiSunLine
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3", color)} />
        <span className="text-[10px] text-muted-foreground/60">{label}</span>
      </div>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", color)}>{value}</p>
    </div>
  )
}

function PowerCell({
  icon: Icon,
  label,
  kw,
  kwh,
  soc,
  color,
}: {
  icon: typeof RiSunLine
  label: string
  kw: number
  kwh?: number
  soc?: number
  color: string
}) {
  const colorMap: Record<string, { text: string; bg: string }> = {
    amber: { text: "text-amber-700", bg: "from-amber-50" },
    emerald: { text: "text-emerald-700", bg: "from-emerald-50" },
    violet: { text: "text-violet-700", bg: "from-violet-50" },
    blue: { text: "text-blue-700", bg: "from-blue-50" },
    cyan: { text: "text-cyan-700", bg: "from-cyan-50" },
  }
  const c = colorMap[color] || colorMap.blue

  return (
    <div className="relative p-4">
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent", c.bg)} />
      <div className="relative">
        <div className={cn("flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider opacity-70", c.text)}>
          <Icon className="size-3" />
          {label}
        </div>
        <p className={cn("mt-2 text-lg font-bold tabular-nums tracking-tight", c.text)}>
          {soc !== undefined ? `${soc}%` : formatPower(kw)}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {soc !== undefined
            ? `${kw > 0 ? "+" : ""}${formatPower(kw)}`
            : kwh !== undefined
              ? `${formatEnergy(kwh)} today`
              : ""}
        </p>
      </div>
    </div>
  )
}

function EnergyRing({
  solarPercent,
  totalKwh,
  selfSufficiency,
}: {
  solarPercent: number
  totalKwh: number
  selfSufficiency: number
}) {
  const radius = 56
  const stroke = 10
  const circumference = 2 * Math.PI * radius
  const solarArc = (solarPercent / 100) * circumference
  const gridArc = circumference - solarArc

  return (
    <div className="relative">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="oklch(0.7 0.12 250)" strokeWidth={stroke} strokeDasharray={`${gridArc} ${circumference}`} strokeDashoffset={0} strokeLinecap="round" className="transition-all duration-700" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke="oklch(0.75 0.16 80)" strokeWidth={stroke} strokeDasharray={`${solarArc} ${circumference}`} strokeDashoffset={-gridArc} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xl font-bold tabular-nums">{formatEnergy(totalKwh)}</p>
        <p className="text-[10px] text-muted-foreground">total today</p>
        <p className="mt-1 text-xs font-medium text-emerald-600">{selfSufficiency.toFixed(0)}% self</p>
      </div>
    </div>
  )
}

function FlowNode({
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
  const colors: Record<string, { bg: string; text: string; icon: string; border: string }> = {
    amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500", border: "border-amber-200" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500", border: "border-blue-200" },
    violet: { bg: "bg-violet-50", text: "text-violet-700", icon: "text-violet-500", border: "border-violet-200" },
    cyan: { bg: "bg-cyan-50", text: "text-cyan-700", icon: "text-cyan-500", border: "border-cyan-200" },
  }
  const c = colors[color] || colors.blue

  return (
    <div className={cn("rounded-lg border p-3", c.bg, c.border)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5", c.icon)} />
        <span className={cn("text-[10px] font-semibold uppercase tracking-wider opacity-70", c.text)}>
          {label}
        </span>
      </div>
      <p className={cn("mt-1.5 text-lg font-bold tabular-nums", c.text)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

function EnergyMixRow({ color, label, value, percent }: { color: string; label: string; value: number; percent: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className={cn("size-2 rounded-full", color)} />
          {label}
        </span>
        <span className="font-medium tabular-nums">
          {formatEnergy(value)} <span className="text-muted-foreground">({percent.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
