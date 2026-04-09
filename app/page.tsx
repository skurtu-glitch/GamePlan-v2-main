"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import { games, userTeams } from "@/lib/data"
import { resolveGameAccess } from "@/lib/resolve-game-access"
import {
  buildHomeSuggestedInsight,
  type HomeInsightCardContent,
} from "@/lib/format-home-insight"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Tv,
  Radio,
  ChevronRight,
  Zap,
  Headphones,
  Calendar,
  Plus,
  Sparkles,
  Check,
} from "lucide-react"

// Filter games for user's teams
const userGames = games.filter((game) =>
  userTeams.some(
    (team) => team.id === game.homeTeam.id || team.id === game.awayTeam.id
  )
)

// Separate tonight's games from upcoming
const now = new Date()
const tonightsGames = userGames.filter((game) => {
  const gameDate = new Date(game.dateTime)
  return gameDate.toDateString() === now.toDateString()
})

const upcomingGames = userGames.filter((game) => {
  const gameDate = new Date(game.dateTime)
  return gameDate.toDateString() !== now.toDateString()
})

// Determine coverage state
type CoverageState = 
  | "all_watchable" 
  | "no_watchable" 
  | "mixed" 
  | "listen_only" 
  | "no_games" 
  | "single_game"
  | "no_services"

function getCoverageState(
  hasConnectedServices: boolean,
  tonightsCount: number,
  watchableTonight: number,
  listenOnlyTonight: number,
): CoverageState {
  if (!hasConnectedServices) return "no_services"
  if (tonightsCount === 0) return "no_games"
  if (tonightsCount === 1) return "single_game"
  if (watchableTonight === tonightsCount) return "all_watchable"
  if (watchableTonight === 0 && listenOnlyTonight === tonightsCount) return "listen_only"
  if (watchableTonight === 0) return "no_watchable"
  return "mixed"
}

function SuggestedForYouCard({ content }: { content: HomeInsightCardContent }) {
  return (
    <Card className="overflow-hidden border-accent/30 bg-gradient-to-r from-accent/10 to-transparent p-0">
      <div className="flex items-start gap-3 border-b border-border/40 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/20">
          <Sparkles className="size-4 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">{content.headline}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{content.summary}</p>
          {content.supportingLine && (
            <p className="mt-2 text-xs font-medium leading-relaxed text-foreground/80">
              {content.supportingLine}
            </p>
          )}
          {content.promoSupportingLine && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {content.promoSupportingLine}
            </p>
          )}
          {content.promoFreshnessLine && (
            <p className="mt-1 text-[10px] text-muted-foreground/75">{content.promoFreshnessLine}</p>
          )}
        </div>
      </div>
      <div className="p-4">
        <Link href={content.ctaHref} className="block">
          <Button className="h-10 w-full gap-2 font-semibold">
            {content.ctaLabel}
            <ChevronRight className="size-4" />
          </Button>
        </Link>
      </div>
    </Card>
  )
}

export default function HomePage() {
  const { state } = useDemoUser()
  const [mounted, setMounted] = useState(false)
  const hasConnectedServices = state.connectedServiceIds.length > 0

  const { watchableTonight, listenOnlyTonight, unavailableTonight } = useMemo(() => {
    let w = 0
    let l = 0
    let u = 0
    for (const game of tonightsGames) {
      const r = resolveGameAccess(game, state)
      if (r.status === "watchable") w++
      else if (r.status === "listen-only") l++
      else u++
    }
    return {
      watchableTonight: w,
      listenOnlyTonight: l,
      unavailableTonight: u,
    }
  }, [state])

  const coverageState = getCoverageState(
    hasConnectedServices,
    tonightsGames.length,
    watchableTonight,
    listenOnlyTonight,
  )

  const suggestedForYou = useMemo(() => buildHomeSuggestedInsight(state, "both"), [state])

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatTime = (dateTime: string) => {
    if (!mounted) return "..."
    return new Date(dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  const formatDate = (dateTime: string) => {
    if (!mounted) return "..."
    const d = new Date(dateTime)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (d.toDateString() === today.toDateString()) return "Tonight"
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow"
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  // Get coverage hero content based on state
  const getCoverageHero = () => {
    switch (coverageState) {
      case "all_watchable":
        return {
          headline: "All games available tonight",
          subtext: "Full coverage with your current plan",
          color: "text-emerald-400",
          icon: <Check className="size-5 text-emerald-400" />
        }
      case "no_watchable":
        return {
          headline: "No games available to watch tonight",
          subtext: `${listenOnlyTonight > 0 ? `${listenOnlyTonight} available to listen` : "Add a service to watch"}`,
          color: "text-zinc-400",
          icon: <Zap className="size-5 text-accent" />
        }
      case "listen_only":
        return {
          headline: "All games available to follow live",
          subtext: "Audio coverage included with your plan",
          color: "text-amber-400",
          icon: <Headphones className="size-5 text-amber-400" />
        }
      case "single_game":
        return {
          headline: watchableTonight === 1 ? "Tonight's game is watchable" : "Tonight's game",
          subtext: watchableTonight === 1 ? "Full video access available" : "Audio only available",
          color: watchableTonight === 1 ? "text-emerald-400" : "text-amber-400",
          icon: watchableTonight === 1 ? <Tv className="size-5 text-emerald-400" /> : <Radio className="size-5 text-amber-400" />
        }
      case "mixed":
      default:
        return {
          headline: `${watchableTonight} of ${tonightsGames.length} games watchable tonight`,
          subtext: "You can follow both games with your current plan",
          color: "text-foreground",
          icon: null
        }
    }
  }

  const heroContent = getCoverageHero()

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50">
        <div className="mx-auto max-w-lg px-5 py-5">
          <p className="text-sm text-muted-foreground">
            Good evening, {state.preferences.displayName}
          </p>
          <h1 className="text-xl font-bold text-foreground">GamePlan</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-5 py-6">
        
        {/* EDGE CASE: No Services Connected */}
        {coverageState === "no_services" && (
          <section className="mb-6">
            <Card className="overflow-hidden border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-0">
              <div className="p-6 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent/20">
                  <Plus className="size-7 text-accent" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  Connect your services
                </h2>
                <p className="mb-5 text-sm text-muted-foreground">
                  Add your streaming subscriptions to see what you can watch
                </p>
                <Link href="/settings/services">
                  <Button className="gap-2">
                    Add Services
                    <ChevronRight className="size-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          </section>
        )}

        {/* EDGE CASE: No Games Tonight */}
        {coverageState === "no_games" && (
          <section className="mb-6">
            <Card className="overflow-hidden border-border bg-card p-0">
              <div className="p-6 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary">
                  <Calendar className="size-7 text-muted-foreground" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  No games tonight
                </h2>
                <p className="text-sm text-muted-foreground">
                  {upcomingGames.length > 0 
                    ? `Next game: ${formatDate(upcomingGames[0].dateTime)}`
                    : "Check back later for upcoming games"
                  }
                </p>
              </div>
            </Card>
          </section>
        )}

        {/* COVERAGE HERO - Shows for all states with games */}
        {tonightsGames.length > 0 && coverageState !== "no_services" && (
          <section className="mb-6">
            <Card className="overflow-hidden border-border bg-card p-0">
              <div className="border-b border-border/50 bg-secondary/30 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Your Coverage Tonight
                </h2>
              </div>
              <div className="p-5">
                {/* Hero Content */}
                <div className="mb-4 flex items-start gap-3">
                  {heroContent.icon && (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      {heroContent.icon}
                    </div>
                  )}
                  <div>
                    <p className={`text-lg font-semibold ${heroContent.color}`}>
                      {heroContent.headline}
                    </p>
                    {heroContent.subtext && (
                      <p className="text-sm text-muted-foreground">{heroContent.subtext}</p>
                    )}
                  </div>
                </div>
                
                {/* Segmented Coverage Bar - Only for multiple games */}
                {tonightsGames.length > 1 && (
                  <>
                    <div className="mb-4 h-3 overflow-hidden rounded-full bg-secondary">
                      <div className="flex h-full">
                        {watchableTonight > 0 && (
                          <div 
                            className="bg-emerald-500 transition-all" 
                            style={{ width: `${(watchableTonight / tonightsGames.length) * 100}%` }} 
                          />
                        )}
                        {listenOnlyTonight > 0 && (
                          <div 
                            className="bg-amber-500 transition-all" 
                            style={{ width: `${(listenOnlyTonight / tonightsGames.length) * 100}%` }} 
                          />
                        )}
                        {unavailableTonight > 0 && (
                          <div 
                            className="bg-zinc-600 transition-all" 
                            style={{ width: `${(unavailableTonight / tonightsGames.length) * 100}%` }} 
                          />
                        )}
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {watchableTonight > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="size-2.5 rounded-full bg-emerald-500" />
                          <span className="text-muted-foreground">Watch</span>
                          <span className="font-medium text-foreground">{watchableTonight}</span>
                        </div>
                      )}
                      {listenOnlyTonight > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="size-2.5 rounded-full bg-amber-500" />
                          <span className="text-muted-foreground">Listen</span>
                          <span className="font-medium text-foreground">{listenOnlyTonight}</span>
                        </div>
                      )}
                      {unavailableTonight > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="size-2.5 rounded-full bg-zinc-600" />
                          <span className="text-muted-foreground">Not available with your plan</span>
                          <span className="font-medium text-foreground">{unavailableTonight}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* Tonight’s games — directly under coverage; no separate section title */}
        {tonightsGames.length > 0 && coverageState !== "no_services" && (
          <section className="mb-8">
            <Card className="overflow-hidden border-border bg-card p-0">
              <div className="divide-y divide-border/50">
                {tonightsGames.map((game) => {
                  const access = resolveGameAccess(game, state)
                  const rowStatus =
                    access.status === "watchable"
                      ? ("watchable" as const)
                      : access.status === "listen-only"
                        ? ("listen" as const)
                        : ("unavailable" as const)

                  const actionText = access.primaryAction.label
                  const fixHint =
                    rowStatus === "watchable"
                      ? null
                      : access.fixRecommendation ?? access.reason ?? null
                  
                  return (
                    <Link key={game.id} href={`/game/${game.id}`} className="block">
                      <div className={`px-4 py-3.5 transition-colors hover:bg-secondary/30 active:bg-secondary/50 ${
                        coverageState === "single_game" ? "py-4" : ""
                      }`}>
                        {/* Line 1: Matchup + Time */}
                        <div className="mb-1.5 flex items-center justify-between">
                          <p className={`font-semibold text-foreground ${coverageState === "single_game" ? "text-base" : ""}`}>
                            {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(game.dateTime)}
                          </p>
                        </div>
                        
                        {/* Expanded info for single game */}
                        {coverageState === "single_game" && (
                          <p className="mb-2 text-sm text-muted-foreground">
                            {game.venue}
                          </p>
                        )}
                        
                        {/* Line 2: Status Badge + Primary Action */}
                        <div className="flex items-center justify-between">
                          {/* Status Badge */}
                          {rowStatus === "watchable" ? (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400">
                              <div className="size-2 rounded-full bg-emerald-500" />
                              Watchable
                            </span>
                          ) : rowStatus === "listen" ? (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-400">
                              <div className="size-2 rounded-full bg-amber-500" />
                              Listen Only
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400">
                              <div className="size-2 rounded-full bg-zinc-500" />
                              Not available with your current plan
                            </span>
                          )}
                          
                          {/* Primary Action */}
                          <span className={`flex items-center gap-1 text-sm font-medium ${
                            rowStatus === "watchable" ? "text-emerald-400" :
                            rowStatus === "listen" ? "text-amber-400" :
                            "text-accent"
                          }`}>
                            {actionText}
                            <ChevronRight className="size-3.5" />
                          </span>
                        </div>
                        
                        {/* Line 3: Fix hint (only for unavailable) */}
                        {fixHint && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {fixHint}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </Card>
          </section>
        )}

        {/* UPCOMING GAMES */}
        {upcomingGames.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {coverageState === "no_games" ? "Coming Up" : "Upcoming Games"}
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {upcomingGames.slice(0, coverageState === "no_games" ? 5 : 3).map((game) => {
                const access = resolveGameAccess(game, state)
                const rowStatus =
                  access.status === "watchable"
                    ? ("watchable" as const)
                    : access.status === "listen-only"
                      ? ("listen" as const)
                      : ("unavailable" as const)

                return (
                  <Link key={game.id} href={`/game/${game.id}`}>
                    <Card className="overflow-hidden border-border bg-card/50 p-0 transition-colors hover:bg-card">
                      <div className="flex flex-col gap-0">
                      <div className="flex items-center gap-3 p-3">
                        <div className="flex items-center -space-x-1.5">
                          <div
                            className="flex size-8 items-center justify-center rounded-md border border-background text-[10px] font-bold text-white"
                            style={{ backgroundColor: game.awayTeam.primaryColor }}
                          >
                            {game.awayTeam.abbreviation}
                          </div>
                          <div
                            className="flex size-8 items-center justify-center rounded-md border border-background text-[10px] font-bold text-white"
                            style={{ backgroundColor: game.homeTeam.primaryColor }}
                          >
                            {game.homeTeam.abbreviation}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(game.dateTime)} · {formatTime(game.dateTime)}
                          </p>
                        </div>
                        <div>
                          {rowStatus === "watchable" ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-400">
                              <Tv className="size-3" />
                            </span>
                          ) : rowStatus === "listen" ? (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-400">
                              <Radio className="size-3" />
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-zinc-500/15 px-2 py-1 text-xs font-medium text-zinc-400">
                              <Zap className="size-3" />
                            </span>
                          )}
                        </div>
                      </div>
                      {rowStatus !== "watchable" && access.fixRecommendation && (
                        <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
                          <p>{access.fixRecommendation}</p>
                          <Link
                            href="/plans"
                            className="mt-1 inline-flex items-center gap-1 font-medium text-accent"
                          >
                            Compare plans
                            <ChevronRight className="size-3.5" />
                          </Link>
                        </div>
                      )}
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Suggested for You — optimizer-led, at end of Home flow */}
        {mounted && hasConnectedServices && suggestedForYou && coverageState !== "no_services" && (
          <section className="mb-2">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Suggested for You
            </p>
            <p className="mb-3 text-xs tabular-nums leading-relaxed text-muted-foreground">
              {suggestedForYou.wowMetricLine}
            </p>
            <SuggestedForYouCard content={suggestedForYou} />
          </section>
        )}

        {/* Complete Empty State - No teams, no games */}
        {tonightsGames.length === 0 && upcomingGames.length === 0 && coverageState !== "no_services" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <Tv className="size-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-foreground">No games scheduled</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Add teams to see their upcoming schedules
            </p>
            <Link href="/teams">
              <Button className="gap-2">
                Add Teams
                <ChevronRight className="size-4" />
              </Button>
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
