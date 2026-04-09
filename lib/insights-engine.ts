/**
 * Proactive, deterministic insights from resolver + optimizer (no LLM).
 * Intended for Home, Assistant, or other surfaces.
 */

import { answerMissingGamesQuestion } from "@/lib/assistant-engine"
import type { DemoUserState } from "@/lib/demo-user"
import { getEngineGames, userTeams } from "@/lib/data"
import {
  calculateIncrementalPlanValue,
  classifyRecommendedPlans,
  getCurrentCoverageBaseline,
} from "@/lib/optimizer-engine"
import { getOptimizerPlanById } from "@/lib/optimizer-plans"
import { resolveGameAccess } from "@/lib/resolve-game-access"
import type { Game } from "@/lib/types"

const INSIGHT_SCOPE = "both" as const

export type InsightType =
  | "missing-games"
  | "watch-upgrade"
  | "plan-recommendation"
  | "coverage-summary"

export interface InsightAction {
  label: string
  href: string
}

export interface UserInsight {
  id: string
  type: InsightType
  headline: string
  summary: string
  primaryAction?: InsightAction
  secondaryAction?: InsightAction
}

function formatMatchup(game: Game): string {
  return `${game.awayTeam.city} ${game.awayTeam.name} @ ${game.homeTeam.city} ${game.homeTeam.name}`
}

function userTeamGames(): Game[] {
  return getEngineGames().filter((game) =>
    userTeams.some(
      (t) => t.id === game.homeTeam.id || t.id === game.awayTeam.id
    )
  )
}

/**
 * Earliest upcoming user-team game (from `now`) that is not fully watchable on video.
 */
function getNextNonWatchableGame(
  userState: DemoUserState,
  now: Date
): { game: Game; status: string; fixLabel: string } | null {
  const t0 = now.getTime()
  const upcoming = userTeamGames()
    .filter((g) => new Date(g.dateTime).getTime() >= t0)
    .sort(
      (a, b) =>
        new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    )

  for (const game of upcoming) {
    const r = resolveGameAccess(game, userState)
    if (r.status === "watchable") continue
    const fixLabel =
      r.fixRecommendation ??
      (r.status === "listen-only" ? r.primaryAction.label : "See plans")
    return { game, status: r.status, fixLabel }
  }
  return null
}

function buildWatchUpgradeInsight(
  userState: DemoUserState,
  now: Date
): UserInsight | null {
  const hit = getNextNonWatchableGame(userState, now)
  if (!hit) return null

  const { game, status, fixLabel } = hit
  const statusPhrase =
    status === "listen-only"
      ? "Listen only without a video add-on"
      : "Video not available with current services"

  return {
    id: "insight-watch-upgrade",
    type: "watch-upgrade",
    headline: "Next game isn’t fully watchable",
    summary: `${formatMatchup(game)} — ${statusPhrase}. Best next step: ${fixLabel}.`,
    primaryAction: { label: "Open game", href: `/game/${game.id}` },
    secondaryAction: { label: "Connected services", href: "/settings/services" },
  }
}

function buildMissingGamesInsight(
  userState: DemoUserState,
  now: Date
): UserInsight | null {
  const ans = answerMissingGamesQuestion(INSIGHT_SCOPE, userState, now)
  if (ans.missingGames.length === 0) return null

  const first = ans.missingGames[0]
  const extra =
    ans.missingGames.length > 1
      ? ` (+${ans.missingGames.length - 1} more this week)`
      : ""

  return {
    id: "insight-missing-week",
    type: "missing-games",
    headline: ans.headline,
    summary: `${ans.summary} Next up: ${first.label}${extra}.`,
    primaryAction: ans.primaryAction.href
      ? { label: ans.primaryAction.label, href: ans.primaryAction.href }
      : undefined,
    secondaryAction:
      ans.secondaryAction?.href && ans.secondaryAction
        ? { label: ans.secondaryAction.label, href: ans.secondaryAction.href }
        : undefined,
  }
}

function buildPlanRecommendationInsight(
  userState: DemoUserState
): UserInsight | null {
  const classified = classifyRecommendedPlans(INSIGHT_SCOPE, userState)
  const id = classified.bestValuePlanId
  if (!id) return null

  const plan = getOptimizerPlanById(id)
  if (!plan) return null

  const inc = calculateIncrementalPlanValue(plan, INSIGHT_SCOPE, userState)
  if (inc.newlyWatchableGames <= 0 && inc.incrementalCost <= 0) return null

  return {
    id: "insight-plan-best-value",
    type: "plan-recommendation",
    headline: `Best value: ${plan.name}`,
    summary:
      inc.newlyWatchableGames > 0
        ? `Optimizer picks “${plan.name}” — about ${inc.newlyWatchableGames} more watchable game(s) on the sample schedule for roughly +$${inc.incrementalCost.toFixed(2)}/mo vs your priced services.`
        : `Optimizer highlights “${plan.name}” for this footprint (no extra sample unlocks; compare catalog coverage).`,
    primaryAction: { label: "Compare plans", href: "/plans" },
    secondaryAction: { label: "Plan details", href: `/plans/${plan.id}` },
  }
}

function buildCoverageSummaryInsight(userState: DemoUserState): UserInsight {
  const b = getCurrentCoverageBaseline(INSIGHT_SCOPE, userState)
  return {
    id: "insight-coverage-baseline",
    type: "coverage-summary",
    headline: "Sample-schedule coverage",
    summary: `With your current services you can watch ${b.gamesWatchable} of ${b.totalGames} games on the demo sample (${b.coveragePercent}%) for both teams.`,
    primaryAction: { label: "View plans", href: "/plans" },
    secondaryAction: { label: "Assistant", href: "/assistant" },
  }
}

/**
 * Ordered insights: most time-sensitive / actionable first, then context.
 *
 * 1. Next non-watchable upcoming game (watch-upgrade)
 * 2. Rolling-week gaps from real schedule + assistant missing-games pipeline
 * 3. Optimizer best-value + incremental sample value (plan-recommendation)
 * 4. Baseline sample coverage (coverage-summary)
 */
export function getUserInsights(
  userState: DemoUserState,
  now = new Date()
): UserInsight[] {
  const out: UserInsight[] = []

  const watch = buildWatchUpgradeInsight(userState, now)
  if (watch) out.push(watch)

  const missing = buildMissingGamesInsight(userState, now)
  if (missing) out.push(missing)

  const plan = buildPlanRecommendationInsight(userState)
  if (plan) out.push(plan)

  out.push(buildCoverageSummaryInsight(userState))

  return out
}

