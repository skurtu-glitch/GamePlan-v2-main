"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tv, Radio, Sparkles, Check, X, AlertCircle, ChevronRight, Plus, ArrowUpRight, Play } from "lucide-react"
import type { Game, AvailabilityStatus, AccessStatus, ActionOption } from "@/lib/types"
import { cn } from "@/lib/utils"

interface GameCardProps {
  game: Game
  variant?: "default" | "compact" | "featured"
}

function formatGameTime(dateTime: string): { date: string; time: string; isTonight: boolean } {
  const d = new Date(dateTime)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let date: string
  const isTonight = d.toDateString() === now.toDateString()
  
  if (isTonight) {
    date = "Tonight"
  } else if (d.toDateString() === tomorrow.toDateString()) {
    date = "Tomorrow"
  } else {
    date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
  }

  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

  return { date, time, isTonight }
}

function useFormattedGameTime(dateTime: string) {
  const [formatted, setFormatted] = useState<{ date: string; time: string; isTonight: boolean } | null>(null)

  useEffect(() => {
    setFormatted(formatGameTime(dateTime))
  }, [dateTime])

  return formatted
}

function AccessStatusChip({ status }: { status: AccessStatus }) {
  const config = {
    watchable: {
      icon: Check,
      label: "Watchable now",
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    unavailable: {
      icon: X,
      label: "Not available with your current plan",
      bg: "bg-red-500/15",
      text: "text-red-400",
      border: "border-red-500/30",
    },
    upgrade: {
      icon: AlertCircle,
      label: "Upgrade required to watch",
      bg: "bg-amber-500/15",
      text: "text-amber-400",
      border: "border-amber-500/30",
    },
  }

  const c = config[status]
  const Icon = c.icon

  return (
    <div className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5", c.bg, c.border)}>
      <Icon className={cn("size-3.5", c.text)} />
      <span className={cn("text-xs font-medium", c.text)}>{c.label}</span>
    </div>
  )
}

function StatusIndicator({ status, label }: { status: AvailabilityStatus; label: string }) {
  const config = {
    available: {
      icon: Check,
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
    },
    unavailable: {
      icon: X,
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/20",
    },
    partial: {
      icon: AlertCircle,
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
    },
  }

  const c = config[status]
  const Icon = c.icon

  return (
    <div className={cn("flex items-center gap-1 rounded-md border px-2 py-1", c.bg, c.border)}>
      <Icon className={cn("size-3", c.text)} />
      <span className={cn("text-[11px] font-medium", c.text)}>{label}</span>
    </div>
  )
}

function LeagueBadge({ sport }: { sport: string }) {
  const colors: Record<string, string> = {
    NHL: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    MLB: "bg-red-500/15 text-red-400 border-red-500/30",
    NFL: "bg-green-500/15 text-green-400 border-green-500/30",
    NBA: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  }

  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider", colors[sport] || "bg-secondary text-muted-foreground")}>
      {sport}
    </span>
  )
}

function ActionButton({ action, compact = false }: { action: ActionOption; compact?: boolean }) {
  const iconMap = {
    add: Plus,
    upgrade: ArrowUpRight,
    open: Play,
    view: ChevronRight,
  }
  const Icon = iconMap[action.type]

  if (compact) {
    return (
      <button className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <Icon className="size-3" />
        <span>{action.label}</span>
        {action.price && <span className="text-muted-foreground/70">{action.price}</span>}
      </button>
    )
  }

  return (
    <button className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-md bg-secondary">
          <Icon className="size-3.5 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground">{action.label}</span>
      </div>
      {action.price && (
        <span className="text-xs font-medium text-muted-foreground">{action.price}</span>
      )}
    </button>
  )
}

export function GameCard({ game, variant = "default" }: GameCardProps) {
  const formatted = useFormattedGameTime(game.dateTime)

  const date = formatted?.date ?? "..."
  const time = formatted?.time ?? ""
  const isTonight = formatted?.isTonight ?? false

  if (variant === "compact") {
    return (
      <Link href={`/game/${game.id}`} className="block">
        <Card className="overflow-hidden border-border bg-card/50 p-0 transition-colors hover:bg-card">
          <div className="flex items-center gap-4 p-4">
            <div className="flex flex-1 items-center gap-3">
              <div className="flex items-center -space-x-2">
                <div
                  className="flex size-10 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white"
                  style={{ backgroundColor: game.awayTeam.primaryColor }}
                >
                  {game.awayTeam.abbreviation}
                </div>
                <div
                  className="flex size-10 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white"
                  style={{ backgroundColor: game.homeTeam.primaryColor }}
                >
                  {game.homeTeam.abbreviation}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {game.awayTeam.name} @ {game.homeTeam.name}
                </p>
                <p className="text-xs text-muted-foreground">{date}{time && ` \u00b7 ${time}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LeagueBadge sport={game.homeTeam.sport} />
            </div>
          </div>
        </Card>
      </Link>
    )
  }

  // Default full card with personalized access
  return (
    <Card className="group relative overflow-hidden border-border bg-card p-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <LeagueBadge sport={game.homeTeam.sport} />
          <span className={cn(
            "text-sm font-medium",
            isTonight ? "text-foreground" : "text-muted-foreground"
          )}>
            {date}{time && ` \u00b7 ${time}`}
          </span>
        </div>
        <Link 
          href={`/game/${game.id}`}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Details
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {/* Matchup */}
      <div className="px-4 py-5">
        <div className="flex items-center justify-between">
          {/* Away Team */}
          <div className="flex items-center gap-3">
            <div
              className="flex size-14 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg"
              style={{ backgroundColor: game.awayTeam.primaryColor }}
            >
              {game.awayTeam.abbreviation}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{game.awayTeam.name}</p>
              <p className="text-xs text-muted-foreground">{game.awayTeam.city}</p>
            </div>
          </div>

          <div className="px-3">
            <span className="text-sm font-bold text-muted-foreground/50">@</span>
          </div>

          {/* Home Team */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-right text-base font-semibold text-foreground">{game.homeTeam.name}</p>
              <p className="text-right text-xs text-muted-foreground">{game.homeTeam.city}</p>
            </div>
            <div
              className="flex size-14 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg"
              style={{ backgroundColor: game.homeTeam.primaryColor }}
            >
              {game.homeTeam.abbreviation}
            </div>
          </div>
        </div>

        {game.venue && (
          <p className="mt-3 text-center text-xs text-muted-foreground">{game.venue}</p>
        )}
      </div>

      {/* Personalized Access Section */}
      {game.access ? (
        <div className="border-t border-border/50 bg-secondary/20">
          {/* Watch Status */}
          <div className="border-b border-border/30 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <AccessStatusChip status={game.access.status} />
              <div className="flex items-center gap-2">
                <StatusIndicator 
                  status={game.listen.status} 
                  label={game.listen.status === "available" ? "Audio" : "No Audio"} 
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{game.access.reason}</p>
          </div>

          {/* What You Can Do */}
          <div className="px-4 py-3">
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              What you can do
            </p>
            <div className="flex flex-col gap-2">
              {game.access.actions.slice(0, 3).map((action, idx) => (
                <ActionButton key={idx} action={action} />
              ))}
            </div>
          </div>

          {/* Best Value */}
          <div className="border-t border-border/30 bg-accent/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" />
                <span className="text-sm font-medium text-foreground">
                  Best value tonight:
                </span>
                <span className="text-sm font-semibold text-accent">
                  {game.access.bestOption.label}
                </span>
              </div>
              {game.access.bestOption.action.price && (
                <span className="text-xs font-medium text-muted-foreground">
                  {game.access.bestOption.action.price}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Fallback for games without access data */
        <div className="border-t border-border/50 bg-secondary/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Tv className="size-3.5 text-muted-foreground" />
                <StatusIndicator status={game.watch.status} label={game.watch.status === "available" ? "Watch" : game.watch.status === "partial" ? "Limited" : "No"} />
              </div>
              <div className="flex items-center gap-1">
                <Radio className="size-3.5 text-muted-foreground" />
                <StatusIndicator status={game.listen.status} label={game.listen.status === "available" ? "Listen" : "No"} />
              </div>
            </div>

            {game.recommendation && (
              <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5">
                <Sparkles className="size-3.5 text-accent" />
                <span className="text-xs font-semibold text-accent">{game.recommendation}</span>
              </div>
            )}
          </div>

          {(game.watch.provider || game.watch.note) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {game.watch.provider && <span>{game.watch.provider}</span>}
              {game.watch.note && <span className="text-muted-foreground/70"> &middot; {game.watch.note}</span>}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
