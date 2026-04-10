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
import { getEngineGames, teamsForFollowedIds } from "@/lib/data"
import {
  followedTeamNamesPlus,
  followedTeamsScopePhrase,
} from "@/lib/followed-teams-copy"
import {
  groupScheduleGamesByLeague,
  sortGamesByStartTime,
  upcomingSampleWatchCounts,
} from "@/lib/home-upcoming-schedule"
import { classifyRecommendedPlans } from "@/lib/optimizer-engine"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

export default function SchedulePage() {
  const { state } = useDemoUser()
  const { isHydrating: isScheduleHydrating, scheduleVersion } = useSchedule()
  const [mounted, setMounted] = useState(false)
  const hasConnectedServices = state.connectedServiceIds.length > 0
  const scheduleBlocked = isScheduleHydrating && hasConnectedServices

  const followedGames = useMemo(() => {
    const followed = teamsForFollowedIds(state.followedTeamIds)
    return getEngineGames().filter((game) =>
      followed.some((t) => t.id === game.homeTeam.id || t.id === game.awayTeam.id)
    )
  }, [state.followedTeamIds, scheduleVersion])

  const sortedGames = useMemo(() => sortGamesByStartTime(followedGames), [followedGames])
  const byLeague = useMemo(() => groupScheduleGamesByLeague(sortedGames), [sortedGames])
  const watchCounts = useMemo(
    () => upcomingSampleWatchCounts(sortedGames, state),
    [sortedGames, state]
  )
  const recommendations = useMemo(
    () => classifyRecommendedPlans("both", state),
    [state, scheduleVersion]
  )

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

        {!scheduleBlocked && (
          <>
            <div className="mb-6 flex flex-col gap-1">
              <p className="text-sm font-medium leading-snug text-foreground/90">
                <span className="tabular-nums">{watchCounts.total}</span> games on your calendar
                {" · "}
                <span className="tabular-nums">{watchCounts.watchable}</span> watchable on video
              </p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Same access rules as Home — per game via your subscriptions and market settings.
              </p>
            </div>

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
                  <section>
                    <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      NHL
                    </h2>
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
                  </section>
                )}
                {byLeague.mlb.length > 0 && (
                  <section>
                    <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      MLB
                    </h2>
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
                  </section>
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
