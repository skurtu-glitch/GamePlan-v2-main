/**
 * Home “Suggested for You” copy — derived from optimizer + sample baseline (live with demo user state).
 */

import type { DemoUserState } from "@/lib/demo-user"
import {
  calculateIncrementalPlanValue,
  calculateNearTermIncrementalValue,
  classifyRecommendedPlans,
  DEFAULT_NEAR_TERM_OPTIMIZER_DAYS,
  getCurrentCoverageBaseline,
  getUpcomingCoverageWindow,
  type CurrentCoverageBaseline,
  type UpcomingCoverageWindow,
} from "@/lib/optimizer-engine"
import {
  getOptimizerPlanById,
  type OptimizerPlan,
  type OptimizerScope,
} from "@/lib/optimizer-plans"
import { serviceDisplayName } from "@/lib/streaming-service-ids"
import { getPlanBundlePromoSummary } from "@/lib/promotion-pricing"

export const HOME_SUGGESTED_CTA_LABEL = "Review Details in Plan Optimizer" as const

export interface HomeInsightCardContent {
  /** Sample-schedule baseline (same source as optimizer Home scope). */
  wowMetricLine: string
  headline: string
  summary: string
  supportingLine?: string
  /** From {@link getPlanBundlePromoSummary}; only when promos are fresh + medium/high confidence. */
  promoSupportingLine?: string
  promoFreshnessLine?: string
  ctaLabel: typeof HOME_SUGGESTED_CTA_LABEL
  ctaHref: string
}

/** Shown above/below the Suggested card; values from `getCurrentCoverageBaseline` (sample schedule). */
export function formatHomeWowMetric(baseline: CurrentCoverageBaseline): string {
  return `You can currently watch ${baseline.gamesWatchable} of ${baseline.totalGames} upcoming games (${baseline.coveragePercent}%)`
}

/** Near-term line from real engine games in the rolling window (e.g. next 7 days). */
export function formatHomeWowMetricNearTerm(window: UpcomingCoverageWindow): string {
  if (window.totalGames === 0) {
    return `No games for your teams in the next ${window.days} days on the demo schedule`
  }
  return `In the next ${window.days} days, you can watch ${window.gamesWatchable} of ${window.totalGames} games (${window.coveragePercent}%)`
}

const HOME_BEST_VALUE_PLAN_HEADLINE =
  "Watch significantly more of your games with the Best Value plan" as const

function formatAddsAndUnlocksLine(serviceCount: number, newlyWatchable: number): string {
  const svc = serviceCount === 1 ? "service" : "services"
  return `Adds ${serviceCount} ${svc} and unlocks ~${newlyWatchable} more games you can watch`
}

const VIDEO_SERVICE_IDS = new Set([
  "espn-plus",
  "max",
  "fanduel-sports",
  "mlb-tv",
  "nhl-tv",
  "directv",
  "youtube-tv",
])

function userHasVideo(state: DemoUserState): boolean {
  return state.connectedServiceIds.some((id) => VIDEO_SERVICE_IDS.has(id))
}

function videoServicesConnected(state: DemoUserState): string[] {
  return state.connectedServiceIds.filter((id) => VIDEO_SERVICE_IDS.has(id))
}

function formatConjoinedList(names: string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
}

function hasAllPlanServices(plan: OptimizerPlan, state: DemoUserState): boolean {
  const c = new Set(state.connectedServiceIds)
  return plan.servicesIncluded.every((id) => c.has(id))
}

/**
 * Promo-aware supporting copy for the recommended catalog plan. Uses bundle pricing only when
 * {@link getPlanBundlePromoSummary} reports `showPromoLine` (fresh + medium/high confidence).
 */
function withRecommendedPlanPromo(
  plan: OptimizerPlan | undefined,
  insight: HomeInsightCardContent,
  now: Date = new Date()
): HomeInsightCardContent {
  if (!plan) return insight
  const bundle = getPlanBundlePromoSummary(plan, now)
  if (
    !bundle.showPromoLine ||
    bundle.introEffectiveMonthlyUsd === undefined ||
    bundle.introPeriodMonths === undefined
  ) {
    return insight
  }

  const savings = bundle.savingsVsBaseMonthlyUsd ?? 0
  const softer =
    savings >= 0.01 ? "With current offers, your intro cost is lower. " : ""
  const numeric = `~$${bundle.introEffectiveMonthlyUsd.toFixed(
    2
  )}/mo avg. for the first ${bundle.introPeriodMonths} months with current offers.`
  const listRef = ` Bundle list price is $${bundle.baseMonthlyUsd.toFixed(0)}/mo.`

  return {
    ...insight,
    promoSupportingLine: `${softer}${numeric}${listRef}`.trim(),
    promoFreshnessLine: bundle.freshnessLine,
  }
}

/**
 * Structured Home insight; `null` when the user has no connected services (Home handles connect CTA elsewhere).
 */
export function buildHomeSuggestedInsight(
  userState: DemoUserState,
  scope: OptimizerScope = "both"
): HomeInsightCardContent | null {
  if (userState.connectedServiceIds.length === 0) return null

  const ctaLabel = HOME_SUGGESTED_CTA_LABEL
  const baseline = getCurrentCoverageBaseline(scope, userState)
  const upcoming = getUpcomingCoverageWindow(
    scope,
    userState,
    DEFAULT_NEAR_TERM_OPTIMIZER_DAYS
  )
  const classified = classifyRecommendedPlans(scope, userState)
  const bestPlan =
    classified.bestValuePlanId != null
      ? getOptimizerPlanById(classified.bestValuePlanId)
      : undefined
  const fullPlan =
    classified.fullCoveragePlanId != null
      ? getOptimizerPlanById(classified.fullCoveragePlanId)
      : undefined

  const wowMetricLine =
    upcoming.totalGames > 0
      ? formatHomeWowMetricNearTerm(upcoming)
      : formatHomeWowMetric(baseline)

  if (fullPlan && hasAllPlanServices(fullPlan, userState)) {
    return withRecommendedPlanPromo(fullPlan, {
      wowMetricLine,
      headline: "You're at full coverage for both teams",
      summary:
        "Your connected services match the Full Coverage bundle on the demo catalog—sample games for the Blues and Cardinals resolve as watchable with your current footprint.",
      supportingLine:
        baseline.totalGames > 0
          ? `${baseline.gamesWatchable} of ${baseline.totalGames} sample games are watchable with the teams you follow.`
          : undefined,
      ctaLabel,
      ctaHref: `/plans/${fullPlan.id}`,
    })
  }

  if (!userHasVideo(userState)) {
    const ctaHref = bestPlan && classified.bestValuePlanId ? `/plans/${classified.bestValuePlanId}` : "/plans"
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: "Add a video service to unlock watchable games",
      summary:
        "You're on audio-only access today. The Plan Optimizer shows the lightest video stacks that turn radio follow-alongs into watches on the demo sample—without jumping straight to full coverage.",
      supportingLine: bestPlan
        ? `Best Value on the catalog is “${bestPlan.name}”—review incremental cost and coverage there.`
        : undefined,
      ctaLabel,
      ctaHref,
    })
  }

  if (bestPlan && hasAllPlanServices(bestPlan, userState)) {
    const extras =
      fullPlan && !hasAllPlanServices(fullPlan, userState)
        ? fullPlan.servicesIncluded
            .filter((id) => !userState.connectedServiceIds.includes(id))
            .map(serviceDisplayName)
        : []
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: "You're already aligned with Best Value",
      summary:
        "Your subscriptions cover everything in the Best Value tier for this demo. Open the optimizer only if you want to compare against Full Coverage or rebalance cost.",
      supportingLine:
        extras.length > 0
          ? `Full Coverage adds ${formatConjoinedList(extras)} if you want every national and overflow window.`
          : undefined,
      ctaLabel,
      ctaHref: `/plans/${bestPlan.id}`,
    })
  }

  if (!bestPlan || !classified.bestValuePlanId) {
    return {
      wowMetricLine,
      headline: "Compare bundles for your teams",
      summary:
        "Use the Plan Optimizer to rank catalog plans by watchable games and monthly cost on the Blues + Cardinals sample schedule.",
      ctaLabel,
      ctaHref: "/plans",
    }
  }

  const inc = calculateIncrementalPlanValue(bestPlan, scope, userState)
  const nearInc = calculateNearTermIncrementalValue(
    bestPlan,
    scope,
    userState,
    DEFAULT_NEAR_TERM_OPTIMIZER_DAYS
  )
  const effectiveNewlyWatchable = Math.max(
    inc.newlyWatchableGames,
    nearInc.newlyWatchableGames
  )
  const keyAdds = inc.incrementalServices.filter((id) => VIDEO_SERVICE_IDS.has(id))
  const keyAddNames = keyAdds.map(serviceDisplayName)
  const haveNames = videoServicesConnected(userState).map(serviceDisplayName)

  const missingWatchableSample =
    baseline.totalGames > 0 ? Math.max(0, baseline.totalGames - baseline.gamesWatchable) : 0
  const missingWatchableNear =
    upcoming.totalGames > 0
      ? Math.max(0, upcoming.totalGames - upcoming.gamesWatchable)
      : 0
  const missingWatchable = Math.max(missingWatchableSample, missingWatchableNear)

  const strongUnlock =
    effectiveNewlyWatchable >= 6 ||
    (missingWatchable > 0 && effectiveNewlyWatchable / missingWatchable >= 0.55)

  if (inc.newlyWatchableGames <= 0 && inc.incrementalCost <= 0) {
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: "Fine-tune your stack in the Plan Optimizer",
      summary: `You're at ${baseline.coveragePercent}% watchable on the demo sample (${baseline.gamesWatchable} of ${baseline.totalGames} games). Compare “${bestPlan.name}” with Full Coverage to see whether a broader tier is worth the step-up.`,
      ctaLabel,
      ctaHref: `/plans/${bestPlan.id}`,
    })
  }

  if (strongUnlock && keyAddNames.length >= 2) {
    const havePart =
      haveNames.length > 0 ? `You already have ${formatConjoinedList(haveNames)}. ` : ""
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: HOME_BEST_VALUE_PLAN_HEADLINE,
      summary: `${havePart}Adding ${formatConjoinedList(
        keyAddNames
      )} fills the key gaps—unlocking most of the games you're currently missing without paying for full coverage.`,
      supportingLine: formatAddsAndUnlocksLine(
        inc.incrementalServices.length,
        effectiveNewlyWatchable
      ),
      ctaLabel,
      ctaHref: `/plans/${bestPlan.id}`,
    })
  }

  if (strongUnlock && keyAddNames.length === 1) {
    const havePart =
      haveNames.length > 0 ? `You already have ${formatConjoinedList(haveNames)}. ` : ""
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: HOME_BEST_VALUE_PLAN_HEADLINE,
      summary: `${havePart}Adding ${keyAddNames[0]} fills a major gap—unlocking most of the games you're currently missing without paying for full coverage.`,
      supportingLine: formatAddsAndUnlocksLine(
        inc.incrementalServices.length,
        effectiveNewlyWatchable
      ),
      ctaLabel,
      ctaHref: `/plans/${bestPlan.id}`,
    })
  }

  if (effectiveNewlyWatchable > 0) {
    const havePart =
      haveNames.length > 0 ? `You already have ${formatConjoinedList(haveNames)}. ` : ""
    const addPart =
      keyAddNames.length > 0
        ? `Adding ${formatConjoinedList(
            keyAddNames
          )} picks up about ${effectiveNewlyWatchable} more watchable game(s) on the demo schedule (or next ${DEFAULT_NEAR_TERM_OPTIMIZER_DAYS} days, whichever is stronger) for roughly +$${inc.incrementalCost.toFixed(
            2
          )}/mo.`
        : `“${
            bestPlan.name
          }” picks up about ${effectiveNewlyWatchable} more watchable game(s) on the demo schedule (or next ${DEFAULT_NEAR_TERM_OPTIMIZER_DAYS} days, whichever is stronger) for roughly +$${inc.incrementalCost.toFixed(
            2
          )}/mo.`
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: HOME_BEST_VALUE_PLAN_HEADLINE,
      summary: `${havePart}${addPart}`,
      supportingLine: `Best Value pick: ${bestPlan.name}.`,
      ctaLabel,
      ctaHref: `/plans/${bestPlan.id}`,
    })
  }

  return withRecommendedPlanPromo(bestPlan, {
    wowMetricLine,
    headline: "Optimize cost vs. coverage with Best Value",
    summary: `“${
      bestPlan.name
    }” is still the catalog’s Best Value anchor for both teams—worth a pass in the optimizer even when sample unlocks are flat, especially if you’re weighing swaps across services.`,
    ctaLabel,
    ctaHref: `/plans/${bestPlan.id}`,
  })
}
