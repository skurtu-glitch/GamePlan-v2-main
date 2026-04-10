/**
 * Home “Suggested for You” copy — live schedule coverage (resolver) + catalog optimizer for upgrades.
 */

import {
  getCurrentUserCoverageSummary,
  type CurrentUserCoverageSummary,
} from "@/lib/current-user-coverage"
import type { DemoUserState } from "@/lib/demo-user"
import {
  calculateIncrementalPlanValue,
  classifyRecommendedPlans,
} from "@/lib/optimizer-engine"
import {
  getOptimizerPlanById,
  type OptimizerPlan,
  type OptimizerScope,
} from "@/lib/optimizer-plans"
import { serviceDisplayName } from "@/lib/streaming-service-ids"
import { getPlanBundlePromoSummary } from "@/lib/promotion-pricing"
import { formatBundlePlusList } from "@/lib/conversion-copy"

export const HOME_SUGGESTED_CTA_LABEL = "Review details" as const

export interface HomeInsightCardContent {
  /** Live schedule in scope: watchable / total / % via {@link resolveGameAccess}. */
  wowMetricLine: string
  headline: string
  summary: string
  /** Catalog list price for the focal plan (always shown when a plan is in play). */
  listPriceLine?: string
  supportingLine?: string
  /** From {@link getPlanBundlePromoSummary}; only when promos are fresh + medium/high confidence. */
  promoSupportingLine?: string
  promoFreshnessLine?: string
  /** Catalog services in the focal plan, for bundle clarity. */
  bundleIncludesLine?: string
  ctaLabel: typeof HOME_SUGGESTED_CTA_LABEL
  ctaHref: string
}

export function formatHomeWowMetric(
  summary: Pick<
    CurrentUserCoverageSummary,
    "gamesWatchable" | "totalGames" | "coveragePercent"
  >
): string {
  return `Across Blues + Cardinals: ${summary.gamesWatchable} of ${summary.totalGames} games watchable on your in-app schedule (${summary.coveragePercent}%)`
}

const HOME_BEST_VALUE_PLAN_HEADLINE =
  "Watch significantly more of your games with the Best Value plan" as const

function formatAddsAndUnlocksLine(serviceCount: number, unlockSeason: number): string {
  const svc = serviceCount === 1 ? "service" : "services"
  return `Adds ${serviceCount} ${svc} · Season catalog: +${unlockSeason} more watchable games (full-season model)`
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
  const listPriceLine =
    plan.monthlyCost > 0
      ? `List price: $${plan.monthlyCost.toFixed(2)}/mo · ${plan.name}`
      : `List price: Free · ${plan.name}`

  const bundle = getPlanBundlePromoSummary(plan, now)
  const bundleIncludesLine = `Includes: ${formatBundlePlusList(plan.servicesIncluded)}`
  if (
    !bundle.showPromoLine ||
    bundle.introEffectiveMonthlyUsd === undefined ||
    bundle.introPeriodMonths === undefined
  ) {
    return { ...insight, listPriceLine, bundleIncludesLine }
  }

  const savings = bundle.savingsVsBaseMonthlyUsd ?? 0
  const softer =
    savings >= 0.01 ? "With current offers, your intro cost is lower. " : ""
  const numeric = `~$${bundle.introEffectiveMonthlyUsd.toFixed(
    2
  )}/mo avg. for the first ${bundle.introPeriodMonths} months with current offers.`
  const listRef = ` Bundle list price is $${bundle.baseMonthlyUsd.toFixed(0)}/mo.`
  const classicPromo = `${softer}${numeric}${listRef}`.trim()

  return {
    ...insight,
    listPriceLine,
    bundleIncludesLine,
    promoSupportingLine: bundle.promoReframeLine ?? classicPromo,
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
  const live = getCurrentUserCoverageSummary(scope, userState)
  const wowMetricLine = formatHomeWowMetric(live)
  const classified = classifyRecommendedPlans(scope, userState)
  const bestPlan =
    classified.bestValuePlanId != null
      ? getOptimizerPlanById(classified.bestValuePlanId)
      : undefined
  const fullPlan =
    classified.fullCoveragePlanId != null
      ? getOptimizerPlanById(classified.fullCoveragePlanId)
      : undefined

  if (fullPlan && hasAllPlanServices(fullPlan, userState)) {
    return withRecommendedPlanPromo(fullPlan, {
      wowMetricLine,
      headline: "You're at full coverage for both teams",
      summary:
        "Your connected services match the Full Coverage catalog plan for Blues + Cardinals (both teams).",
      supportingLine:
        live.totalGames > 0
          ? `Both teams: ${live.gamesWatchable} of ${live.totalGames} games on your in-app schedule are watchable with your services.`
          : undefined,
      ctaLabel,
      ctaHref: `/plans/${fullPlan.id}`,
    })
  }

  if (!userHasVideo(userState)) {
    const ctaHref = bestPlan && classified.bestValuePlanId ? `/plans/${classified.bestValuePlanId}` : "/plans"
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: "Add video for Blues + Cardinals",
      summary:
        "You're on audio-only access today. The Plan Optimizer shows the lightest video stacks that turn radio follow-alongs into watches—without jumping straight to full coverage.",
      supportingLine: bestPlan
        ? `Season catalog Best Value: “${bestPlan.name}”—review incremental cost and coverage there.`
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
        "Your subscriptions cover everything in the Best Value tier. Open the optimizer if you want to compare against Full Coverage or rebalance cost.",
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
        "Use the Plan Optimizer to rank season-catalog plans by watchable games and monthly cost for both teams.",
      ctaLabel,
      ctaHref: "/plans",
    }
  }

  const inc = calculateIncrementalPlanValue(bestPlan, scope, userState)
  const unlockSeason = inc.newlyWatchableGames
  const missingWatchable =
    live.totalGames > 0 ? Math.max(0, live.totalGames - live.gamesWatchable) : 0
  const keyAdds = inc.incrementalServices.filter((id) => VIDEO_SERVICE_IDS.has(id))
  const keyAddNames = keyAdds.map(serviceDisplayName)
  const haveNames = videoServicesConnected(userState).map(serviceDisplayName)

  const strongUnlock =
    unlockSeason >= 6 || (missingWatchable > 0 && unlockSeason / missingWatchable >= 0.55)

  if (inc.newlyWatchableGames <= 0 && inc.incrementalCost <= 0) {
    return withRecommendedPlanPromo(bestPlan, {
      wowMetricLine,
      headline: "Fine-tune your stack in the Plan Optimizer",
      summary: `You're at ${live.coveragePercent}% watchable on your schedule (${live.gamesWatchable} of ${live.totalGames} games). Compare “${bestPlan.name}” with Full Coverage to see whether a broader tier is worth the step-up.`,
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
      )} fills the key gaps—season catalog: unlocking most of what you’re missing vs full coverage, without paying for the full bundle.`,
      supportingLine: formatAddsAndUnlocksLine(inc.incrementalServices.length, unlockSeason),
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
      summary: `${havePart}Adding ${keyAddNames[0]} fills a major gap—season catalog: unlocking most of what you’re missing vs full coverage.`,
      supportingLine: formatAddsAndUnlocksLine(inc.incrementalServices.length, unlockSeason),
      ctaLabel,
      ctaHref: `/plans/${bestPlan.id}`,
    })
  }

  if (unlockSeason > 0) {
    const havePart =
      haveNames.length > 0 ? `You already have ${formatConjoinedList(haveNames)}. ` : ""
    const addPart =
      keyAddNames.length > 0
        ? `Adding ${formatConjoinedList(
            keyAddNames
          )} — season catalog estimate: about ${unlockSeason} more watchable games for roughly +$${inc.incrementalCost.toFixed(2)}/mo.`
        : `“${
            bestPlan.name
          }” — season catalog estimate: about ${unlockSeason} more watchable games for roughly +$${inc.incrementalCost.toFixed(2)}/mo.`
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
    }” is still the catalog’s Best Value anchor for both teams—worth a pass in the optimizer when you want to weigh swaps across services.`,
    ctaLabel,
    ctaHref: `/plans/${bestPlan.id}`,
  })
}
