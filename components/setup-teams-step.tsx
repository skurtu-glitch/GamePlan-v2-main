"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CATALOG_LEAGUES, catalogTeamsInLeague, teamsForFollowedIds } from "@/lib/data"
import type { League } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowLeft, Check } from "lucide-react"

type SetupTeamsStepProps = {
  league: League | null
  onLeagueChange: (league: League | null) => void
  followedTeamIds: readonly string[]
  onToggleTeam: (teamId: string, follow: boolean) => void
  onContinue: () => void
}

function leagueTeamCount(league: League): number {
  return catalogTeamsInLeague(league).length
}

/**
 * League-first, multi-select team onboarding (visual pattern aligned with My Teams + Add Team).
 * Selection writes through parent to `followedTeamIds` on each tap.
 */
export function SetupTeamsStep({
  league,
  onLeagueChange,
  followedTeamIds,
  onToggleTeam,
  onContinue,
}: SetupTeamsStepProps) {
  const followedSet = useMemo(() => new Set(followedTeamIds), [followedTeamIds])

  const followedTeams = useMemo(
    () => teamsForFollowedIds(followedTeamIds),
    [followedTeamIds]
  )

  const leagueTeams = useMemo(() => {
    if (!league) return []
    const list = catalogTeamsInLeague(league)
    return [...list].sort((a, b) => {
      const af = followedSet.has(a.id) ? 0 : 1
      const bf = followedSet.has(b.id) ? 0 : 1
      if (af !== bf) return af - bf
      return `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`)
    })
  }, [league, followedSet])

  const canContinue = followedTeamIds.length >= 1

  return (
    <Card className="border-border p-5">
      <h2 className="text-lg font-semibold text-foreground">Your teams</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a league, tap teams to follow. Home and your schedule update right away.
      </p>

      {followedTeams.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {followedTeams.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[11px] font-medium text-foreground"
            >
              {t.abbreviation}
            </span>
          ))}
        </div>
      )}

      {league === null ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {CATALOG_LEAGUES.map((lg) => (
            <button
              key={lg}
              type="button"
              onClick={() => onLeagueChange(lg)}
              className={cn(
                "flex min-h-[100px] flex-col items-start justify-end rounded-xl border-2 border-border bg-gradient-to-br from-secondary/80 to-card p-4 text-left transition-colors",
                "hover:border-accent/50 hover:from-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              )}
            >
              <span className="text-xl font-bold tracking-tight text-foreground">{lg}</span>
              <span className="mt-1 text-xs text-muted-foreground">
                {leagueTeamCount(lg)} teams · tap to pick
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 h-auto gap-1.5 px-2 py-1 text-muted-foreground"
            onClick={() => onLeagueChange(null)}
          >
            <ArrowLeft className="size-4 shrink-0" />
            All leagues
          </Button>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {league} · tap to add or remove
          </p>
          <div className="grid max-h-[min(52vh,440px)] grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {leagueTeams.map((team) => {
              const on = followedSet.has(team.id)
              return (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggleTeam(team.id, !on)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-colors",
                    on
                      ? "border-accent bg-accent/10 shadow-sm"
                      : "border-border/80 bg-card hover:border-accent/30 hover:bg-secondary/40"
                  )}
                >
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                      <Check className="size-3.5 stroke-[3]" aria-hidden />
                    </span>
                  )}
                  <div
                    className="flex size-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
                    style={{ backgroundColor: team.primaryColor }}
                  >
                    {team.abbreviation}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">
                      {team.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{team.city}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <Button
            type="button"
            className="mt-5 w-full"
            disabled={!canContinue}
            onClick={onContinue}
          >
            Continue
          </Button>
        </div>
      )}
    </Card>
  )
}
