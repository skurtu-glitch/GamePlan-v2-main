/**
 * Deterministic Assistant layer: structured answers from resolver + optimizer (no LLM).
 */

import { getEngineGames, userTeams } from "@/lib/data"
import type { Game } from "@/lib/types"
import type { DemoUserState } from "@/lib/demo-user"
import {
  getCurrentUserCoverageSummary,
  getEngineGamesForOptimizerScope,
} from "@/lib/current-user-coverage"
import {
  classifyRecommendedPlans,
  calculateIncrementalPlanValue,
  estimateMonthlyCostForConnectedServices,
} from "@/lib/optimizer-engine"
import { getOptimizerPlanById, type OptimizerScope } from "@/lib/optimizer-plans"
import { resolveGameAccess } from "@/lib/resolve-game-access"

// ——— Watch question ———

export type WatchQuestionStatus = "watchable" | "listen-only" | "not-available"

export interface AssistantAction {
  label: string
  href?: string
}

export interface WatchQuestionAnswer {
  type: "watch-question"
  headline: string
  summary: string
  status: WatchQuestionStatus
  primaryAction: AssistantAction
  secondaryAction?: AssistantAction
  reasons: string[]
}

// ——— Plan question ———

export interface PlanQuestionAnswer {
  type: "plan-question"
  headline: string
  summary: string
  recommendations: {
    cheapestPlanId: string | null
    bestValuePlanId: string | null
    fullCoveragePlanId: string | null
    radioPlanId: string | null
  }
  reasons: string[]
}

// ——— Missing games ———

export interface MissingGameRow {
  gameId: string
  label: string
  dateLabel: string
  status: "listen-only" | "not-available"
}

export interface MissingGamesAnswer {
  type: "missing-games"
  headline: string
  summary: string
  /** Live schedule in scope via {@link getCurrentUserCoverageSummary} (resolver, same as Home / Plans card). */
  baseline: {
    scope: OptimizerScope
    gamesWatchable: number
    totalGames: number
    coveragePercent: number
  }
  missingGames: MissingGameRow[]
  upgradeHint: {
    planId: string | null
    planName: string | null
    /** Catalog delta vs current footprint: upgraded plan gamesWatchable − baseline (season). */
    unlockMoreGamesThisSeason: number
    incrementalCost: number
  }
  reasons: string[]
  primaryAction: AssistantAction
  secondaryAction?: AssistantAction
}

// ——— Suggested prompts ———

export interface SuggestedPrompt {
  text: string
}

function getGameById(gameId: string): Game | undefined {
  return getEngineGames().find((g) => g.id === gameId)
}

function formatMatchup(game: Game): string {
  const away = `${game.awayTeam.city} ${game.awayTeam.name}`
  const home = `${game.homeTeam.city} ${game.homeTeam.name}`
  return `${away} @ ${home}`
}

function formatGameDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

const SCOPE_HEADLINE: Record<OptimizerScope, string> = {
  blues: "Blues",
  cardinals: "Cardinals",
  both: "both teams",
}

/** Same engine rows as {@link getCurrentUserCoverageSummary} for `scope` (not filtered by followed teams). */
function gamesMatchingScope(scope: OptimizerScope): Game[] {
  return getEngineGamesForOptimizerScope(scope)
}

/** Rolling 7-day window on the same scope set as season coverage summaries. */
function gamesInRollingWeek(scope: OptimizerScope, now = new Date()): Game[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return gamesMatchingScope(scope).filter((g) => {
    const t = new Date(g.dateTime).getTime()
    return t >= start.getTime() && t < end.getTime()
  })
}

export function answerWatchQuestion(
  gameId: string,
  userState: DemoUserState
): WatchQuestionAnswer {
  const game = getGameById(gameId)
  if (!game) {
    return {
      type: "watch-question",
      headline: "Game not found",
      summary: "That game id is not in the schedule.",
      status: "not-available",
      primaryAction: { label: "Browse home schedule", href: "/" },
      reasons: [`No game matches id "${gameId}".`],
    }
  }

  const resolved = resolveGameAccess(game, userState)
  const matchup = formatMatchup(game)
  const dateLine = formatGameDateLabel(game.dateTime)

  const reasons: string[] = []
  if (resolved.status === "watchable") {
    reasons.push(`Video: ${resolved.primaryAction.label}.`)
    if (resolved.providers.length > 0) {
      reasons.push(`Feeds: ${resolved.providers.join(", ")}.`)
    }
  } else if (resolved.status === "listen-only") {
    reasons.push(resolved.reason ?? "Video is not included with your services.")
    if (resolved.fixRecommendation) {
      reasons.push(resolved.fixRecommendation)
    }
    reasons.push(`${resolved.primaryAction.label} is still available.`)
  } else {
    reasons.push(resolved.reason ?? "Video is not available.")
    if (resolved.fixRecommendation) {
      reasons.push(resolved.fixRecommendation)
    }
  }

  let headline = matchup
  let summary: string
  let primaryAction: AssistantAction
  let secondaryAction: AssistantAction | undefined

  if (resolved.status === "watchable") {
    summary = `You can watch this game (${dateLine}).`
    primaryAction = {
      label: resolved.primaryAction.label,
      href: `/game/${game.id}`,
    }
    secondaryAction = {
      label: "Connected services",
      href: "/settings/services",
    }
  } else if (resolved.status === "listen-only") {
    headline = `${matchup} — listen only`
    summary = `You can’t watch with your current services, but audio is available (${dateLine}).`
    primaryAction = {
      label: resolved.primaryAction.label,
      href: `/game/${game.id}`,
    }
    secondaryAction = {
      label: "Add a service to watch",
      href: "/settings/services",
    }
  } else {
    headline = `${matchup} — not available`
    summary = `This game isn’t watchable on your current setup (${dateLine}).`
    primaryAction = {
      label: resolved.fixRecommendation ?? "See plans",
      href: "/plans",
    }
    secondaryAction = {
      label: "Manage services",
      href: "/settings/services",
    }
  }

  return {
    type: "watch-question",
    headline,
    summary,
    status: resolved.status,
    primaryAction,
    secondaryAction,
    reasons,
  }
}

export function answerPlanQuestion(
  scope: OptimizerScope,
  userState: DemoUserState
): PlanQuestionAnswer {
  const rec = classifyRecommendedPlans(scope, userState)
  const { explanations } = rec

  const name = (id: string | null) =>
    id ? getOptimizerPlanById(id)?.name ?? id : "—"

  const cheapest = rec.cheapestPlanId
  const best = rec.bestValuePlanId
  const full = rec.fullCoveragePlanId
  const radio = rec.radioPlanId

  const headline = `Plans for ${SCOPE_HEADLINE[scope]}`
  const summary = [
    `Cheapest video: ${name(cheapest)}.`,
    best ? `Best value: ${name(best)}.` : `Best value: (no pick for this setup).`,
    `Full coverage: ${name(full)}.`,
    `Radio fallback: ${name(radio)}.`,
  ].join(" ")

  const reasons: string[] = []
  if (cheapest) {
    reasons.push(
      `Cheapest (${name(cheapest)}): ${explanations.cheapest}`
    )
  }
  if (best) {
    reasons.push(`Best value (${name(best)}): ${explanations.bestValue}`)
  } else {
    reasons.push(
      "Best value: no plan met the optimizer threshold; compare Cheapest and Full Coverage."
    )
  }
  if (full) {
    reasons.push(`Full coverage (${name(full)}): ${explanations.fullCoverage}`)
  }
  if (radio) {
    reasons.push(`Radio (${name(radio)}): ${explanations.radio}`)
  }

  const monthly = estimateMonthlyCostForConnectedServices(userState)
  if (monthly > 0) {
    reasons.push(
      `Your estimated monthly spend on priced connected services: $${monthly.toFixed(2)}.`
    )
  }

  const live = getCurrentUserCoverageSummary(scope, userState)
  reasons.push(
    `On your schedule with your current services: ${live.gamesWatchable} of ${live.totalGames} games watchable (${live.coveragePercent}%).`
  )

  return {
    type: "plan-question",
    headline,
    summary,
    recommendations: {
      cheapestPlanId: cheapest,
      bestValuePlanId: best,
      fullCoveragePlanId: full,
      radioPlanId: radio,
    },
    reasons,
  }
}

export function answerMissingGamesQuestion(
  scope: OptimizerScope,
  userState: DemoUserState,
  now = new Date()
): MissingGamesAnswer {
  const weekGames = gamesInRollingWeek(scope, now)
  const missing: MissingGameRow[] = []

  for (const game of weekGames) {
    const r = resolveGameAccess(game, userState)
    if (r.status === "watchable") continue
    missing.push({
      gameId: game.id,
      label: formatMatchup(game),
      dateLabel: formatGameDateLabel(game.dateTime),
      status: r.status === "listen-only" ? "listen-only" : "not-available",
    })
  }

  const baseline = getCurrentUserCoverageSummary(scope, userState)
  const classified = classifyRecommendedPlans(scope, userState)
  const bestId = classified.bestValuePlanId ?? classified.fullCoveragePlanId
  const bestPlan = bestId ? getOptimizerPlanById(bestId) : undefined

  let unlockMoreGamesThisSeason = 0
  let incrementalCost = 0
  if (bestPlan) {
    const inc = calculateIncrementalPlanValue(bestPlan, scope, userState)
    unlockMoreGamesThisSeason = inc.newlyWatchableGames
    incrementalCost = inc.incrementalCost
  }

  const reasons: string[] = [
    `Live schedule (${SCOPE_HEADLINE[scope]}): with your current services, ${baseline.gamesWatchable} of ${baseline.totalGames} games are watchable (${baseline.coveragePercent}%).`,
  ]

  if (missing.length === 0) {
    reasons.push(
      "Every game in this 7-day window is watchable on video with your current setup."
    )
  } else {
    reasons.push(
      `${missing.length} game(s) in this window are not fully watchable on video — see the list below.`
    )
    if (bestPlan && unlockMoreGamesThisSeason > 0) {
      reasons.push(
        `Season catalog (full-season model): “${bestPlan.name}” could add about ${unlockMoreGamesThisSeason} more watchable games vs the catalog baseline (≈ +$${incrementalCost.toFixed(2)}/mo vs your priced services).`
      )
    } else if (bestPlan) {
      reasons.push(
        `Consider “${bestPlan.name}” for more season-catalog coverage; incremental unlocks are small for your current entitlements.`
      )
    }
  }

  return {
    type: "missing-games",
    headline: `Missing video — ${SCOPE_HEADLINE[scope]}`,
    summary:
      missing.length === 0
        ? "No video gaps in this 7-day window—Details shows your live schedule summary."
        : `You’re missing full video for ${missing.length} game(s) below. Compare plans for season-catalog upgrades.`,
    baseline: {
      scope,
      gamesWatchable: baseline.gamesWatchable,
      totalGames: baseline.totalGames,
      coveragePercent: baseline.coveragePercent,
    },
    missingGames: missing,
    upgradeHint: {
      planId: bestId,
      planName: bestPlan?.name ?? null,
      unlockMoreGamesThisSeason,
      incrementalCost,
    },
    reasons,
    primaryAction:
      missing.length > 0
        ? { label: "Compare plans", href: "/plans" }
        : { label: "View schedule", href: "/" },
    secondaryAction:
      missing.length > 0
        ? { label: "Connected services", href: "/settings/services" }
        : undefined,
  }
}

export function createSuggestedPrompts(userState: DemoUserState): SuggestedPrompt[] {
  const prompts: SuggestedPrompt[] = []

  const now = new Date()
  const tonights = getEngineGames().filter((game) => {
    if (
      !userTeams.some(
        (t) => t.id === game.homeTeam.id || t.id === game.awayTeam.id
      )
    ) {
      return false
    }
    const gameDate = new Date(game.dateTime)
    return gameDate.toDateString() === now.toDateString()
  })

  const bluesTonight = tonights.some(
    (g) => g.homeTeam.id === "stl-blues" || g.awayTeam.id === "stl-blues"
  )
  const cardsTonight = tonights.some(
    (g) =>
      g.homeTeam.id === "stl-cardinals" || g.awayTeam.id === "stl-cardinals"
  )

  if (bluesTonight) {
    prompts.push({ text: "Can I watch tonight’s Blues game?" })
  }
  if (cardsTonight) {
    prompts.push({ text: "Why can’t I watch the Cardinals tonight?" })
  }

  prompts.push({ text: "What’s the cheapest way to watch more games?" })
  prompts.push({ text: "What am I missing on video?" })

  const hasVideo = userState.connectedServiceIds.some((id) =>
    ["espn-plus", "mlb-tv", "fanduel-sports", "max"].includes(id)
  )
  if (!hasVideo) {
    prompts.push({ text: "What should I add first?" })
  }

  return prompts
}
