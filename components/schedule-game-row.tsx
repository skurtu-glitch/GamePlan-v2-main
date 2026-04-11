"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import {
  AnalyticsEvent,
  analyticsBase,
  trackEvent,
  type AnalyticsSourceScreen,
} from "@/lib/analytics"
import { ACCESS_RULES_SEE_PLANS } from "@/lib/access-rules"
import type { DemoUserState } from "@/lib/demo-user"
import { homeGameRowPrimaryLabel, labelSeeAllPlans } from "@/lib/conversion-copy"
import { resolveGameAccess } from "@/lib/resolve-game-access"
import type { Game } from "@/lib/types"
import { ChevronRight, Radio, Tv, Zap } from "lucide-react"

export function ScheduleGameRow({
  game,
  demoState,
  formatDate,
  formatTime,
  recommendedPlanId,
  analyticsSurface,
  watchEventLabel,
  onSeePlansNav,
}: {
  game: Game
  demoState: DemoUserState
  formatDate: (iso: string) => string
  formatTime: (iso: string) => string
  recommendedPlanId: string | null | undefined
  analyticsSurface: AnalyticsSourceScreen
  watchEventLabel: string
  /** Optional hook for soft-auth upsell when opening the plans catalog from this row. */
  onSeePlansNav?: () => void
}) {
  const access = resolveGameAccess(game, demoState)
  const rowStatus =
    access.status === "watchable"
      ? ("watchable" as const)
      : access.status === "listen-only"
        ? ("listen" as const)
        : ("unavailable" as const)
  const rowActionLabel = homeGameRowPrimaryLabel(access)
  const fixHint =
    rowStatus !== "watchable" &&
    access.fixRecommendation &&
    access.fixRecommendation !== ACCESS_RULES_SEE_PLANS
      ? access.fixRecommendation
      : null

  return (
    <Card className="overflow-hidden border-border bg-card/50 p-0 transition-colors hover:bg-card">
      <div className="flex flex-col gap-0">
        <Link
          href={`/game/${game.id}`}
          className="block"
          onClick={() =>
            trackEvent(AnalyticsEvent.watchActionClick, {
              ...analyticsBase(analyticsSurface, demoState, {
                game_id: game.id,
                href: `/game/${game.id}`,
                label: watchEventLabel,
              }),
              recommended_plan_id: recommendedPlanId ?? undefined,
            })
          }
        >
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
            <div className="flex shrink-0 flex-col items-end gap-1">
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
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  rowStatus === "watchable"
                    ? "text-emerald-400"
                    : rowStatus === "listen"
                      ? "text-amber-400"
                      : "text-accent"
                }`}
              >
                {rowActionLabel}
                <ChevronRight className="size-3" />
              </span>
            </div>
          </div>
        </Link>
        {rowStatus !== "watchable" && (
          <div className="border-t border-border/40 px-3 py-2 text-xs text-muted-foreground">
            {access.reason && (
              <p className="leading-snug text-muted-foreground">{access.reason}</p>
            )}
            {fixHint && <p className={access.reason ? "mt-1" : ""}>{fixHint}</p>}
            <Link
              href="/plans"
              className={`inline-flex items-center gap-1 font-medium text-accent ${
                fixHint ? "mt-1" : ""
              }`}
              onClick={() => {
                onSeePlansNav?.()
                trackEvent(AnalyticsEvent.ctaSecondaryClick, {
                  ...analyticsBase(analyticsSurface, demoState, {
                    href: "/plans",
                    label: labelSeeAllPlans(),
                    game_id: game.id,
                  }),
                })
                trackEvent(AnalyticsEvent.comparePlansClick, {
                  ...analyticsBase(analyticsSurface, demoState, {
                    href: "/plans",
                    label: labelSeeAllPlans(),
                    game_id: game.id,
                  }),
                })
              }}
            >
              {labelSeeAllPlans()}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}
