"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import type { Team } from "@/lib/types"

interface TeamCardProps {
  team: Team
  gamesCount?: number
}

export function TeamCard({ team, gamesCount = 0 }: TeamCardProps) {
  return (
    <Card className="group border-border bg-card p-0 transition-colors hover:bg-secondary/50">
      <button className="flex w-full items-center gap-4 p-4 text-left">
        <div
          className="flex size-14 items-center justify-center rounded-xl text-lg font-bold text-foreground"
          style={{ backgroundColor: team.primaryColor }}
        >
          {team.abbreviation}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">
            {team.city} {team.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {team.sport} &middot; {gamesCount} upcoming {gamesCount === 1 ? "game" : "games"}
          </p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    </Card>
  )
}

interface AddTeamCardProps {
  onAdd?: () => void
}

export function AddTeamCard({ onAdd }: AddTeamCardProps) {
  return (
    <Card className="border-dashed border-border bg-transparent">
      <button
        onClick={onAdd}
        className="flex w-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground transition-colors hover:text-foreground"
      >
        <div className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-current">
          <span className="text-2xl">+</span>
        </div>
        <span className="text-sm font-medium">Add a Team</span>
      </button>
    </Card>
  )
}
