"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { AddTeamDialog } from "@/components/add-team-dialog"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import {
  ScheduleHydrationSkeleton,
  useSchedule,
} from "@/components/providers/schedule-provider"
import { getEngineGames, teams, teamsForFollowedIds } from "@/lib/data"
import { getCurrentUserTeamCoverage } from "@/lib/current-user-coverage"
import { resolveGameAccess } from "@/lib/resolve-game-access"
import {
  ChevronLeft,
  ChevronRight,
  Tv,
  Radio,
  UserMinus,
} from "lucide-react"
import { serviceDisplayName } from "@/lib/streaming-service-ids"

function nextUpcomingGameForTeam(teamId: string, now: Date) {
  const t0 = now.getTime()
  const candidates = getEngineGames()
    .filter((g) => g.homeTeam.id === teamId || g.awayTeam.id === teamId)
    .filter((g) => new Date(g.dateTime).getTime() >= t0)
    .sort(
      (a, b) =>
        new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    )
  return candidates[0]
}

export default function TeamsPage() {
  const [mounted, setMounted] = useState(false)
  const [addTeamOpen, setAddTeamOpen] = useState(false)
  const { isHydrating: isScheduleHydrating } = useSchedule()
  const { state, setDemoUserState } = useDemoUser()
  const userTeams = teamsForFollowedIds(state.followedTeamIds)

  const otherTeams = useMemo(
    () => teams.filter((t) => !state.followedTeamIds.includes(t.id)),
    [state.followedTeamIds]
  )
  const canAddFromCatalog = otherTeams.length > 0

  function toggleFollow(teamId: string, follow: boolean) {
    setDemoUserState((prev) => {
      const ids = prev.followedTeamIds
      if (follow) {
        if (ids.includes(teamId)) return prev
        return { ...prev, followedTeamIds: [...ids, teamId] }
      }
      if (ids.length <= 1) return prev
      return {
        ...prev,
        followedTeamIds: ids.filter((id) => id !== teamId),
      }
    })
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  const formatDateTime = (dateTime: string) => {
    if (!mounted) return { date: "...", time: "" }
    const d = new Date(dateTime)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    return {
      date: isToday
        ? "Tonight"
        : d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
      time: d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-4 px-4">
          <Link
            href="/"
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Teams</h1>
            <p className="text-xs text-muted-foreground">
              {userTeams.length} teams followed
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Team Cards */}
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Your Teams
          </h2>
          {isScheduleHydrating ? (
            <ScheduleHydrationSkeleton />
          ) : (
          <div className="flex flex-col gap-4">
            {userTeams.map((team) => {
              const coverage = getCurrentUserTeamCoverage(team.id, state)
              const total = coverage.totalGames
              const percentage = coverage.coveragePercent
              const watchPct =
                total > 0 ? (coverage.gamesWatchable / total) * 100 : 0
              const listenPct =
                total > 0 ? (coverage.gamesListenOnly / total) * 100 : 0
              const nextGame = nextUpcomingGameForTeam(team.id, new Date())
              const { date, time } = nextGame
                ? formatDateTime(nextGame.dateTime)
                : { date: "", time: "" }
              const nextAccess = nextGame
                ? resolveGameAccess(nextGame, state)
                : null

              return (
                <Card
                  key={team.id}
                  className="overflow-hidden border-border bg-card p-0"
                >
                  {/* Team Header */}
                  <div className="border-b border-border/50 p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex size-14 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg"
                        style={{ backgroundColor: team.primaryColor }}
                      >
                        {team.abbreviation}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground">
                          {team.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{team.league}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-400">
                          {percentage}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Coverage
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Coverage Stats */}
                  <div className="border-b border-border/50 bg-secondary/20 p-4">
                    <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-secondary">
                      <div className="flex h-full">
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{ width: `${watchPct}%` }}
                        />
                        <div
                          className="bg-amber-500 transition-all"
                          style={{ width: `${listenPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-emerald-500" />
                        <span className="text-muted-foreground">Watchable:</span>
                        <span className="font-medium text-foreground">
                          {coverage.gamesWatchable}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-amber-500" />
                        <span className="text-muted-foreground">Listen:</span>
                        <span className="font-medium text-foreground">
                          {coverage.gamesListenOnly}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-muted-foreground/40" />
                        <span className="text-muted-foreground">
                          Unavailable:
                        </span>
                        <span className="font-medium text-foreground">
                          {coverage.gamesUnavailable}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        of {total} on schedule
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {state.connectedServiceIds.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          No connected services — add some in Settings to see
                          accurate access.
                        </span>
                      ) : (
                        state.connectedServiceIds.map((id) => (
                          <span
                            key={id}
                            className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
                          >
                            {serviceDisplayName(id)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Next Game */}
                  {nextGame && (
                    <Link href={`/game/${nextGame.id}`} className="block">
                      <div className="flex items-center justify-between p-4 transition-colors hover:bg-secondary/30">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Next Game
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {nextGame.awayTeam.id === team.id ? "@ " : "vs "}
                            {nextGame.awayTeam.id === team.id
                              ? nextGame.homeTeam.name
                              : nextGame.awayTeam.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {date}
                            {time && ` · ${time}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {nextAccess?.status === "watchable" ? (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                              <Tv className="size-3" /> Watch
                            </span>
                          ) : nextAccess?.status === "listen-only" ? (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
                              <Radio className="size-3" /> Listen
                            </span>
                          ) : null}
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  )}

                  <div className="flex flex-col gap-2 border-t border-border/50 p-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-border"
                      disabled={state.followedTeamIds.length <= 1}
                      onClick={() => toggleFollow(team.id, false)}
                    >
                      <UserMinus className="size-4" />
                      Unfollow
                    </Button>
                    {state.followedTeamIds.length <= 1 && (
                      <p className="text-center text-xs text-muted-foreground">
                        Keep at least one team followed.
                      </p>
                    )}
                  </div>

                  <Link href="/plans">
                    <div className="flex items-center justify-between border-t border-border/50 px-4 py-3 text-accent transition-colors hover:bg-accent/5">
                      <span className="text-sm font-medium">
                        View Season Coverage
                      </span>
                      <ChevronRight className="size-4" />
                    </div>
                  </Link>
                </Card>
              )
            })}
          </div>
          )}
        </section>

        {/* Add team — league-first flow */}
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Add a team
          </h2>
          {canAddFromCatalog ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Pick a league, then choose a team from the catalog. Your follows sync when
                you&apos;re signed in.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={() => setAddTeamOpen(true)}
              >
                Add a team
              </Button>
              <AddTeamDialog
                open={addTeamOpen}
                onOpenChange={setAddTeamOpen}
                followedTeamIds={state.followedTeamIds}
                onFollowTeam={(id) => toggleFollow(id, true)}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;re following every team in the catalog.
            </p>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
