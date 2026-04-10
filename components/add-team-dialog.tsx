"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CATALOG_LEAGUES, catalogTeamsInLeague } from "@/lib/data"
import type { League } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowLeft, UserPlus } from "lucide-react"

type Step = "league" | "team"

export function AddTeamDialog({
  open,
  onOpenChange,
  followedTeamIds,
  onFollowTeam,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  followedTeamIds: readonly string[]
  onFollowTeam: (teamId: string) => void
}) {
  const [step, setStep] = useState<Step>("league")
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)

  useEffect(() => {
    if (!open) {
      setStep("league")
      setSelectedLeague(null)
    }
  }, [open])

  const followedSet = useMemo(() => new Set(followedTeamIds), [followedTeamIds])

  const leagueHasAvailable = (league: League) =>
    catalogTeamsInLeague(league).some((t) => !followedSet.has(t.id))

  const teamsToShow = useMemo(() => {
    if (!selectedLeague) return []
    return catalogTeamsInLeague(selectedLeague).filter((t) => !followedSet.has(t.id))
  }, [selectedLeague, followedSet])

  function pickLeague(league: League) {
    setSelectedLeague(league)
    setStep("team")
  }

  function handleFollow(teamId: string) {
    onFollowTeam(teamId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,560px)] overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle>
            {step === "league" ? "Add a team" : `Add ${selectedLeague} team`}
          </DialogTitle>
          <DialogDescription>
            {step === "league"
              ? "Choose a league, then pick a team from the catalog."
              : "Select a team to follow. You can change this anytime from My Teams."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-4 pb-4">
          {step === "league" && (
            <div className="flex flex-col gap-2 pt-1">
              {CATALOG_LEAGUES.map((league) => {
                const available = leagueHasAvailable(league)
                return (
                  <Button
                    key={league}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto justify-between py-3 font-medium",
                      !available && "pointer-events-none opacity-50"
                    )}
                    disabled={!available}
                    onClick={() => pickLeague(league)}
                  >
                    <span>{league}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {available ? "Choose team" : "All followed"}
                    </span>
                  </Button>
                )
              })}
            </div>
          )}

          {step === "team" && selectedLeague && (
            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-1 -ml-2 w-fit gap-1 text-muted-foreground"
                onClick={() => {
                  setStep("league")
                  setSelectedLeague(null)
                }}
              >
                <ArrowLeft className="size-4" />
                Back to leagues
              </Button>
              {teamsToShow.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  You&apos;re following every {selectedLeague} team in the catalog.
                </p>
              ) : (
                teamsToShow.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
                  >
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                      style={{ backgroundColor: team.primaryColor }}
                    >
                      {team.abbreviation}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.city} · {team.league}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={() => handleFollow(team.id)}
                    >
                      <UserPlus className="size-4" />
                      Follow
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
