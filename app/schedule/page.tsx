"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
import { ScheduleGameRow } from "@/components/schedule-game-row"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import {
  ScheduleHydrationSkeleton,
  useSchedule,
} from "@/components/providers/schedule-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  followedTeamNamesPlus,
  followedTeamsScopePhrase,
} from "@/lib/followed-teams-copy"
import {
  formatScheduledGamesWatchSummaryLine,
  formatUpcomingWatchSecondaryLine,
  getFollowedTeamGames,
  groupScheduleGamesByLeague,
  sortGamesByStartTime,
} from "@/lib/home-upcoming-schedule"
import { summarizeResolverCoverageForGames } from "@/lib/current-user-coverage"
import { classifyRecommendedPlans } from "@/lib/optimizer-engine"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

export default function SchedulePage() {
  const { state } = useDemoUser()
  const { isHydrating: isScheduleHydrating, scheduleVersion } = useSchedule()
  const [mounted, setMounted] = useState(false)
  const scheduleBlocked =
    isScheduleHydrating && state.connectedServiceIds.length > 0

  const followedGames = useMemo(
    () => getFollowedTeamGames(state.followedTeamIds),
    [state.followedTeamIds, scheduleVersion]
  )

  const sortedGames = useMemo(() => sortGamesByStartTime(followedGames), [followedGames])
  const byLeague = useMemo(() => groupScheduleGamesByLeague(sortedGames), [sortedGames])
  const coverage = useMemo(
    () => summarizeResolverCoverageForGames(sortedGames, state),
    [sortedGames, state]
  )
  const scheduleSummaryPrimary = useMemo(
    () =>
      formatScheduledGamesWatchSummaryLine(
        coverage.gamesWatchable,
        coverage.totalGames,
        coverage.totalGames > 0 ? coverage.coveragePercent : undefined
      ),
    [
      coverage.coveragePercent,
      coverage.gamesWatchable,
      coverage.totalGames,
    ]
  )
  const scheduleSummarySecondary = useMemo(
    () =>
      formatUpcomingWatchSecondaryLine(coverage.gamesWatchable, coverage.totalGames),
    [coverage.gamesWatchable, coverage.totalGames]
  )
  const recommendations = useMemo(
    () => classifyRecommendedPlans("both", state),
    [state, scheduleVersion]
  )

  const scheduleMissedCount = useMemo(
    () => Math.max(0, coverage.totalGames - coverage.gamesWatchable),
    [coverage.gamesWatchable, coverage.totalGames]
  )
  const scheduleHasMissedGames =
    !scheduleBlocked && sortedGames.length > 0 && scheduleMissedCount > 0

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatTime = (dateTime: string) => {
    if (!mounted) return "..."
    return new Date(dateTime).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  const formatDate = (dateTime: string) => {
    if (!mounted) return "..."
    const d = new Date(dateTime)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return "Today"
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow"
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-4 px-4">
          <Link
            href="/"
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Schedule</h1>
            <p className="text-xs text-muted-foreground">
              {followedTeamNamesPlus(state.followedTeamIds)} ·{" "}
              {followedTeamsScopePhrase(state.followedTeamIds)}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 py-6">
        {scheduleBlocked && (
          <section className="mb-6">
            <ScheduleHydrationSkeleton />
          </section>
        )}

        {scheduleHasMissedGames && (
          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 dark:bg-amber-500/5">
            <p className="text-sm font-semibold leading-snug text-foreground">
              {scheduleMissedCount === 1
                ? "You're missing 1 game from your followed teams."
                : `You're missing ${scheduleMissedCount} games from your followed teams.`}
            </p>
          </div>
        )}

        {!scheduleBlocked && (
          <>
            {sortedGames.length > 0 && (
              <div className="mb-6 flex flex-col gap-1">
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Your schedule
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {followedTeamNamesPlus(state.followedTeamIds)} ·{" "}
                  {followedTeamsScopePhrase(state.followedTeamIds)}
                </p>
                {scheduleSummaryPrimary && (
                  <p className="text-xs font-medium leading-snug text-foreground/90">
                    {scheduleSummaryPrimary}
                  </p>
                )}
                {scheduleSummarySecondary && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {scheduleSummarySecondary}
                  </p>
                )}
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Same access rules as Home — per game via your subscriptions and market settings.
                </p>
              </div>
            )}

            {sortedGames.length === 0 ? (
              <Card className="overflow-hidden border-border bg-card p-0">
                <div className="p-8 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary">
                    <Calendar className="size-7 text-muted-foreground" />
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-foreground">No games yet</h2>
                  <p className="mb-5 text-sm text-muted-foreground">
                    Follow teams to see their full engine schedule here.
                  </p>
                  <Link href="/teams">
                    <Button className="gap-2">
                      My Teams
                      <ChevronRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <div className="flex flex-col gap-5">
                {byLeague.nhl.length > 0 && (
                  <div>
                    <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      NHL
                    </h3>
                    <div className="flex flex-col gap-3">
                      {byLeague.nhl.map((game) => (
                        <ScheduleGameRow
                          key={game.id}
                          game={game}
                          demoState={state}
                          formatDate={formatDate}
                          formatTime={formatTime}
                          recommendedPlanId={recommendations.bestValuePlanId}
                          analyticsSurface="schedule"
                          watchEventLabel="schedule_game_row"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {byLeague.mlb.length > 0 && (
                  <div>
                    <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      MLB
                    </h3>
                    <div className="flex flex-col gap-3">
                      {byLeague.mlb.map((game) => (
                        <ScheduleGameRow
                          key={game.id}
                          game={game}
                          demoState={state}
                          formatDate={formatDate}
                          formatTime={formatTime}
                          recommendedPlanId={recommendations.bestValuePlanId}
                          analyticsSurface="schedule"
                          watchEventLabel="schedule_game_row"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
