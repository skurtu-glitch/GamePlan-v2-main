"use client"

import { useState, use, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BottomNav } from "@/components/bottom-nav"
import {
  ArrowLeft,
  Tv,
  Radio,
  Check,
  X,
  DollarSign,
  TrendingUp,
  Shield,
  Headphones,
  ChevronRight,
  Zap,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getPlanCoverage, getCoverageStats, type GameCoverage } from "@/lib/plan-coverage"
import { getUpgradesFromPlan, getUpgradeImpactStats } from "@/lib/upgrade-impact"
import { getOptimizerPlanById } from "@/lib/optimizer-plans"
import { serviceDisplayName } from "@/lib/streaming-service-ids"
import { getPlanBundlePromoSummary } from "@/lib/promotion-pricing"
import { PlanPromoCallout } from "@/components/plan-promo-callout"

type FilterType = "all" | "watchable" | "listen-only" | "unavailable"

function getTeamFromPlanId(planId: string): "blues" | "cardinals" | "both" {
  if (planId.startsWith("blues")) return "blues"
  if (planId.startsWith("cardinals")) return "cardinals"
  return "both"
}

function getStatusColor(status: GameCoverage["status"]) {
  switch (status) {
    case "watchable": return "text-emerald-400"
    case "listen-only": return "text-amber-400"
    case "unavailable": return "text-muted-foreground"
  }
}

function getStatusBg(status: GameCoverage["status"]) {
  switch (status) {
    case "watchable": return "bg-emerald-500/15 border-emerald-500/30"
    case "listen-only": return "bg-amber-500/15 border-amber-500/30"
    case "unavailable": return "bg-muted/30 border-muted-foreground/20"
  }
}

function getStatusLabel(status: GameCoverage["status"]) {
  switch (status) {
    case "watchable": return "Watchable"
    case "listen-only": return "Listen Only"
    case "unavailable": return "Not available with your plan"
  }
}

export default function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params)
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>("all")
  
  const plan = getOptimizerPlanById(planId)
  const bundlePromo = useMemo(() => (plan ? getPlanBundlePromoSummary(plan) : null), [plan])
  const team = getTeamFromPlanId(planId)
  const coverage = getPlanCoverage(planId, team)
  const sampleStats = getCoverageStats(coverage)
  const availableUpgrades = getUpgradesFromPlan(planId)
  
  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Plan not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/plans")}>
            Back to Plans
          </Button>
        </div>
      </div>
    )
  }
  
  const filteredGames = coverage.games.filter(game => {
    if (filter === "all") return true
    return game.status === filter
  })
  
  const nhlGames = filteredGames.filter(g => g.sport === "NHL")
  const mlbGames = filteredGames.filter(g => g.sport === "MLB")
  
  const isRadioOnly = plan.tier === "radio"
  const isBestValue = plan.isBestValue === true
  const isFull = plan.tier === "full"

  const seasonWatchable = plan.gamesWatchable
  const seasonListenOnly = plan.gamesListenOnly
  const seasonTotal = plan.totalGames
  const seasonUnavailable = Math.max(0, seasonTotal - seasonWatchable - seasonListenOnly)
  const coveragePercent = plan.coveragePercent

  const filterOptions: { value: FilterType; label: string; count: number }[] = [
    { value: "all", label: "All", count: coverage.games.length },
    { value: "watchable", label: "Watchable", count: sampleStats.watchable },
    { value: "listen-only", label: "Listen Only", count: sampleStats.listenOnly },
  ]

  // Add unavailable filter only if there are unavailable games
  const unavailableCount = sampleStats.total - sampleStats.watchable - sampleStats.listenOnly
  if (unavailableCount > 0) {
    filterOptions.push({ value: "unavailable", label: "Not available with your plan", count: unavailableCount })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-40">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">{plan.name}</h1>
            <p className="text-xs text-muted-foreground">Plan Details</p>
          </div>
          {isBestValue && (
            <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
              <Sparkles className="size-3" />
              Best
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-lg px-5 py-6">
        
        {/* Coverage Hero */}
        <Card className="mb-6 overflow-hidden border-border p-0">
          <div className="flex items-center gap-6 p-6">
            {/* Circular Progress */}
            <div className="relative">
              <svg width="100" height="100" className="-rotate-90 transform">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#coverageGradientDetail)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (coveragePercent / 100) * 264}
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="coverageGradientDetail" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={coveragePercent >= 90 ? "#10b981" : coveragePercent >= 50 ? "#f59e0b" : "#6b7280"} />
                    <stop offset="100%" stopColor={coveragePercent >= 90 ? "#34d399" : coveragePercent >= 50 ? "#fbbf24" : "#9ca3af"} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                  "text-2xl font-bold",
                  coveragePercent >= 90 ? "text-emerald-400" : coveragePercent >= 50 ? "text-amber-400" : "text-muted-foreground"
                )}>
                  {coveragePercent}%
                </span>
                <span className="text-[10px] text-muted-foreground">Coverage</span>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex-1">
              <p className="mb-1 text-sm text-muted-foreground">Season Games</p>
              <p className="mb-3 text-lg font-semibold text-foreground">
                <span className={coveragePercent >= 90 ? "text-emerald-400" : coveragePercent >= 50 ? "text-amber-400" : coveragePercent > 0 ? "text-foreground" : "text-muted-foreground"}>
                  {seasonWatchable}
                </span>
                <span className="text-muted-foreground"> of {seasonTotal}</span>
              </p>
              
              {/* Mini bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                <div className="flex h-full">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{ width: seasonTotal > 0 ? `${(seasonWatchable / seasonTotal) * 100}%` : "0%" }}
                  />
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-amber-400"
                    style={{ width: seasonTotal > 0 ? `${(seasonListenOnly / seasonTotal) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Coverage Breakdown */}
        <Card className="mb-6 overflow-hidden border-border/50 bg-card/50 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="mb-1 flex items-center justify-center gap-1">
                <div className="size-2 rounded-full bg-emerald-500" />
                <span className="text-xl font-bold text-emerald-400">{seasonWatchable}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Watchable</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-center gap-1">
                <div className="size-2 rounded-full bg-amber-500" />
                <span className="text-xl font-bold text-amber-400">{seasonListenOnly}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Listen Only</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-center gap-1">
                <div className="size-2 rounded-full bg-muted-foreground/30" />
                <span className="text-xl font-bold text-muted-foreground">{seasonUnavailable}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">No watch access</p>
            </div>
          </div>
        </Card>

        {/* Plan Summary */}
        <Card className={cn(
          "mb-6 overflow-hidden border-border p-0",
          isBestValue && "border-accent/50 ring-1 ring-accent/20"
        )}>
          <div className="p-5">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex size-11 items-center justify-center rounded-xl",
                  isRadioOnly ? "bg-muted" : isBestValue ? "bg-accent/20" : isFull ? "bg-emerald-500/20" : "bg-secondary"
                )}>
                  {isRadioOnly ? (
                    <Headphones className="size-5 text-muted-foreground" />
                  ) : isBestValue ? (
                    <TrendingUp className="size-5 text-accent" />
                  ) : isFull ? (
                    <Shield className="size-5 text-emerald-400" />
                  ) : (
                    <DollarSign className="size-5 text-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Cost</p>
                  <p className={cn(
                    "text-xl font-bold",
                    plan.monthlyCost === 0 ? "text-emerald-400" : isBestValue ? "text-accent" : "text-foreground"
                  )}>
                    {plan.monthlyCost === 0 ? "Free" : `$${plan.monthlyCost.toFixed(2)}`}
                  </p>
                  {bundlePromo && (
                    <PlanPromoCallout summary={bundlePromo} className="mt-3 border-t border-border/40 pt-3" />
                  )}
                </div>
              </div>
              {plan.monthlyCost > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Per Year</p>
                  <p className="text-sm font-semibold text-muted-foreground">
                    ${(plan.monthlyCost * 12).toFixed(0)}
                  </p>
                </div>
              )}
            </div>

            {/* Services */}
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Included Services
              </p>
              <div className="flex flex-wrap gap-1.5">
                {plan.servicesIncluded.map((serviceId) => (
                  <span
                    key={serviceId}
                    className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    {serviceDisplayName(serviceId)}
                  </span>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {plan.explanation}
            </p>
          </div>
        </Card>

        {/* Upgrade Insight */}
        {availableUpgrades.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Upgrade to Unlock More
            </h3>
            {availableUpgrades.map((upgrade) => {
              const upgradeStats = getUpgradeImpactStats(upgrade)
              return (
                <Link key={upgrade.id} href={`/plans/upgrade/${upgrade.id}`}>
                  <Card className="overflow-hidden border-accent/30 bg-gradient-to-r from-accent/5 to-transparent p-0 transition-all hover:border-accent/50">
                    <div className="flex items-center gap-4 p-4">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15">
                        <Zap className="size-5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          +{upgradeStats.newlyWatchable} more watchable games
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Upgrade to {upgrade.toPlanName} for +${upgradeStats.costDelta.toFixed(2)}/mo
                        </p>
                      </div>
                      <ChevronRight className="size-5 text-accent" />
                    </div>
                  </Card>
                </Link>
              )
            })}
          </section>
        )}

        {/* Filters */}
        <section className="mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === option.value
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>
        </section>

        {/* Game Lists */}
        {nhlGames.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex size-6 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ backgroundColor: "#002F87" }}
              >
                STL
              </div>
              <h3 className="text-sm font-semibold text-foreground">Blues</h3>
              <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                NHL
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{nhlGames.length} games</span>
            </div>
            <div className="flex flex-col gap-2">
              {nhlGames.slice(0, 10).map((game) => (
                <GameRow key={game.id} game={game} />
              ))}
              {nhlGames.length > 10 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  + {nhlGames.length - 10} more games
                </p>
              )}
            </div>
          </section>
        )}

        {mlbGames.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <div
                className="flex size-6 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ backgroundColor: "#C41E3A" }}
              >
                STL
              </div>
              <h3 className="text-sm font-semibold text-foreground">Cardinals</h3>
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                MLB
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{mlbGames.length} games</span>
            </div>
            <div className="flex flex-col gap-2">
              {mlbGames.slice(0, 10).map((game) => (
                <GameRow key={game.id} game={game} />
              ))}
              {mlbGames.length > 10 && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  + {mlbGames.length - 10} more games
                </p>
              )}
            </div>
          </section>
        )}

        {filteredGames.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No games match this filter</p>
          </div>
        )}
      </main>

      {/* Sticky CTA */}
      {!isRadioOnly && availableUpgrades.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-10 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg gap-3">
            <Button className="flex-1 gap-2" size="lg">
              Get This Plan
              <ChevronRight className="size-4" />
            </Button>
            <Link href={`/plans/upgrade/${availableUpgrades[0].id}`} className="shrink-0">
              <Button variant="outline" size="lg" className="gap-2">
                <Zap className="size-4" />
                See Upgrade
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Simple CTA for full plans or radio */}
      {(isRadioOnly || availableUpgrades.length === 0) && (
        <div className="fixed bottom-20 left-0 right-0 z-10 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
          <div className="mx-auto max-w-lg">
            <Button className="w-full gap-2" size="lg">
              {isRadioOnly ? "Use Free Radio" : "Get This Plan"}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function GameRow({ game }: { game: GameCoverage }) {
  return (
    <Card className="border-border/50 bg-card/50 p-0">
      <div className="flex items-center gap-3 p-3">
        {/* Status indicator */}
        <div className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border",
          getStatusBg(game.status)
        )}>
          {game.status === "watchable" ? (
            <Tv className={cn("size-4", getStatusColor(game.status))} />
          ) : game.status === "listen-only" ? (
            <Radio className={cn("size-4", getStatusColor(game.status))} />
          ) : (
            <X className={cn("size-4", getStatusColor(game.status))} />
          )}
        </div>

        {/* Game info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {game.awayTeam} @ {game.homeTeam}
          </p>
          <p className="text-xs text-muted-foreground">
            {game.date} &middot; {game.time}
          </p>
        </div>

        {/* Status badge */}
        <span className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
          getStatusBg(game.status),
          getStatusColor(game.status)
        )}>
          {getStatusLabel(game.status)}
        </span>
      </div>
      
      {/* Provider/Reason */}
      {(game.provider || game.reason) && (
        <div className="border-t border-border/30 bg-secondary/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {game.provider && <span className="font-medium text-foreground/80">{game.provider}</span>}
            {game.provider && game.reason && " — "}
            {game.reason}
          </p>
        </div>
      )}
    </Card>
  )
}
