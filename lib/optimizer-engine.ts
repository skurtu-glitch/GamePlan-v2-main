/**
 * First-pass optimizer: evaluate catalog plans for a scope + demo user state.
 * Shared base for future recommendation scoring (no UI).
 */

import type { DemoUserState } from "@/lib/demo-user"
import {
  DEFAULT_NEAR_TERM_OPTIMIZER_DAYS,
  getNearTermTransitionCounts,
  getUpcomingCoverageWindow,
  type UpcomingCoverageWindow,
} from "@/lib/near-term-coverage"
import {
  getSampleCoverageCounts,
  getSampleTransitionCounts,
} from "@/lib/plan-coverage"
import {
  getPlansForScope,
  type OptimizerPlan,
  type OptimizerScope,
} from "@/lib/optimizer-plans"
import { demoMonthlyPriceUsd } from "@/lib/streaming-service-ids"

/** Sample-schedule baseline for the user’s current Connected Services (same games as Plan Details). */
export interface CurrentCoverageBaseline {
  scope: OptimizerScope
  gamesWatchable: number
  gamesListenOnly: number
  totalGames: number
  coveragePercent: number
}

/** Upgrade delta vs current setup on the sample schedule + incremental cost (Upgrade Impact–aligned). */
export interface IncrementalPlanValue {
  newlyWatchableGames: number
  newlyListenableGames: number
  lostWatchableGames: number
  lostListenableGames: number
  incrementalServices: string[]
  incrementalCost: number
  costPerNewWatchableGame: number
}

export interface PlanCandidateSummary {
  planId: string
  scope: OptimizerScope
  tier: OptimizerPlan["tier"]
  monthlyCost: number
  gamesWatchable: number
  gamesListenOnly: number
  totalGames: number
  coveragePercent: number
  servicesIncluded: string[]
  incrementalServices: string[]
  incrementalCost: number
  costPerWatchableGame: number
  costPerNewWatchableGame: number
}

/** Demo estimate: sum known `SERVICE_DEMO_MONTHLY_USD` for connected ids (missing ids → $0). */
export function estimateMonthlyCostForConnectedServices(userState: DemoUserState): number {
  let sum = 0
  for (const id of userState.connectedServiceIds) {
    const p = demoMonthlyPriceUsd(id)
    if (p !== undefined) sum += p
  }
  return Math.round(sum * 100) / 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Baseline from `userState` on the deterministic **sample** schedule for `scope`
 * (`resolveGameAccess` per game). For real engine games in a rolling window, use
 * {@link getUpcomingCoverageWindow}. Not to be confused with catalog season totals on `OptimizerPlan`.
 */
export function getCurrentCoverageBaseline(
  scope: OptimizerScope,
  userState: DemoUserState
): CurrentCoverageBaseline {
  const c = getSampleCoverageCounts(scope, userState)
  const coveragePercent =
    c.totalGames > 0 ? Math.round((c.gamesWatchable / c.totalGames) * 100) : 0
  return {
    scope,
    gamesWatchable: c.gamesWatchable,
    gamesListenOnly: c.gamesListenOnly,
    totalGames: c.totalGames,
    coveragePercent,
  }
}

/**
 * What changes if the user adopts `plan.servicesIncluded`, vs their current entitlements.
 * Uses the same sample games and resolver as Plan Details / Upgrade Impact.
 *
 * `scope` must match `plan.scope`; otherwise throws so callers don’t mix Blues sample with a Cardinals plan.
 */
export function calculateIncrementalPlanValue(
  plan: OptimizerPlan,
  scope: OptimizerScope,
  userState: DemoUserState
): IncrementalPlanValue {
  if (plan.scope !== scope) {
    throw new Error(
      `calculateIncrementalPlanValue: scope "${scope}" must match plan.scope "${plan.scope}"`
    )
  }

  const connected = new Set(userState.connectedServiceIds)
  const incrementalServices = plan.servicesIncluded.filter((id) => !connected.has(id))

  const baselineCost = estimateMonthlyCostForConnectedServices(userState)
  const incrementalCost = round2(plan.monthlyCost - baselineCost)

  const t = getSampleTransitionCounts(scope, userState, plan.servicesIncluded)

  const costPerNewWatchableGame = round2(
    incrementalCost / Math.max(1, t.newlyWatchableGames)
  )

  return {
    newlyWatchableGames: t.newlyWatchableGames,
    newlyListenableGames: t.newlyListenableGames,
    lostWatchableGames: t.lostWatchableGames,
    lostListenableGames: t.lostListenableGames,
    incrementalServices,
    incrementalCost,
    costPerNewWatchableGame,
  }
}

/**
 * Incremental unlocks on **real** upcoming games in a rolling window (default 7 days), same
 * delta semantics as {@link calculateIncrementalPlanValue} but uses the engine schedule.
 */
export function calculateNearTermIncrementalValue(
  plan: OptimizerPlan,
  scope: OptimizerScope,
  userState: DemoUserState,
  days: number = DEFAULT_NEAR_TERM_OPTIMIZER_DAYS,
  now: Date = new Date()
): IncrementalPlanValue {
  if (plan.scope !== scope) {
    throw new Error(
      `calculateNearTermIncrementalValue: scope "${scope}" must match plan.scope "${plan.scope}"`
    )
  }

  const connected = new Set(userState.connectedServiceIds)
  const incrementalServices = plan.servicesIncluded.filter((id) => !connected.has(id))

  const baselineCost = estimateMonthlyCostForConnectedServices(userState)
  const incrementalCost = round2(plan.monthlyCost - baselineCost)

  const t = getNearTermTransitionCounts(scope, userState, plan.servicesIncluded, days, now)

  const costPerNewWatchableGame = round2(
    incrementalCost / Math.max(1, t.newlyWatchableGames)
  )

  return {
    newlyWatchableGames: t.newlyWatchableGames,
    newlyListenableGames: t.newlyListenableGames,
    lostWatchableGames: t.lostWatchableGames,
    lostListenableGames: t.lostListenableGames,
    incrementalServices,
    incrementalCost,
    costPerNewWatchableGame,
  }
}

/**
 * Re-exported for callers that import optimizer helpers only.
 * @see {@link getUpcomingCoverageWindow} in `near-term-coverage.ts`
 */
export { getUpcomingCoverageWindow, DEFAULT_NEAR_TERM_OPTIMIZER_DAYS }
export type { UpcomingCoverageWindow }

/**
 * Catalog plans for the scope. `userState` reserved for future filtering (e.g. hide redundant tiers).
 */
export function generatePlanCandidates(
  scope: OptimizerScope,
  _userState: DemoUserState
): OptimizerPlan[] {
  return getPlansForScope(scope)
}

/**
 * Summarize one catalog plan vs current entitlements and cost estimate.
 *
 * - **incrementalCost**: catalog `monthlyCost` minus estimated spend for `userState.connectedServiceIds`.
 * - **costPerNewWatchableGame**: uses sample-schedule newly watchable games when > 0; otherwise falls back to `costPerWatchableGame`.
 */
export function summarizePlanCandidate(
  plan: OptimizerPlan,
  userState: DemoUserState
): PlanCandidateSummary {
  const gw = Math.max(1, plan.gamesWatchable)
  const costPerWatchableGame = round2(plan.monthlyCost / gw)

  const delta = calculateIncrementalPlanValue(plan, plan.scope, userState)

  return {
    planId: plan.id,
    scope: plan.scope,
    tier: plan.tier,
    monthlyCost: plan.monthlyCost,
    gamesWatchable: plan.gamesWatchable,
    gamesListenOnly: plan.gamesListenOnly,
    totalGames: plan.totalGames,
    coveragePercent: plan.coveragePercent,
    servicesIncluded: [...plan.servicesIncluded],
    incrementalServices: delta.incrementalServices,
    incrementalCost: delta.incrementalCost,
    costPerWatchableGame,
    costPerNewWatchableGame: delta.costPerNewWatchableGame,
  }
}

/** Summarize every candidate for a scope. */
export function summarizeAllCandidatesForScope(
  scope: OptimizerScope,
  userState: DemoUserState
): PlanCandidateSummary[] {
  return generatePlanCandidates(scope, userState).map((plan) =>
    summarizePlanCandidate(plan, userState)
  )
}

/** Best Value: favors incremental unlocks + catalog coverage %, penalizes incremental cost and extra services. */
const BV_WEIGHT_NEW_WATCHABLE = 2.0
const BV_WEIGHT_COVERAGE_PERCENT = 0.3
const BV_PENALTY_INCREMENTAL_COST = 0.5
const BV_PENALTY_INCREMENTAL_SERVICE = 3.0

/** Best Value candidates need catalog `gamesWatchable` ≥ this fraction of the Full Coverage plan’s. */
const BEST_VALUE_MIN_WATCHABLE_OF_FULL = 0.8

/** Full loses Best Value if ≥20% pricier than another candidate while relative watchable gain vs that candidate ≤ 10%. */
const FULL_VS_OTHER_COST_RATIO = 1.2
const FULL_VS_OTHER_MAX_RELATIVE_WATCHABLE_GAIN = 0.1

/** Plans scored below this cannot win Best Value (Radio Only). */
const BEST_VALUE_RADIO_FLOOR = -1e9

export interface PlanCandidateScore {
  /** `gamesWatchable > 0` and not Radio (catalog season counts). */
  cheapestEligible: boolean
  /** Non-radio plans compete for the max-watchable “Full Coverage” pick. */
  fullCoverageEligible: boolean
  /** Higher is better; Radio tier is forced to a floor so it never wins Best Value. */
  bestValueScore: number
}

export interface ScoredPlanCandidate {
  planId: string
  summary: PlanCandidateSummary
  incremental: IncrementalPlanValue
  /** “Next N days” delta on the engine schedule; used to layer immediacy onto Best Value scoring. */
  nearTermIncremental: IncrementalPlanValue
  score: PlanCandidateScore
}

export const RECOMMENDATION_EXPLANATIONS = {
  cheapest: "Lowest cost option that still gives you video access.",
  bestValue: "Best balance of cost and watchable games.",
  fullCoverage: "Maximizes watchable games.",
  radio: "Free audio fallback with no video access.",
} as const

export interface ClassifiedRecommendations {
  cheapestPlanId: string | null
  bestValuePlanId: string | null
  fullCoveragePlanId: string | null
  radioPlanId: string | null
  scoredCandidates: ScoredPlanCandidate[]
  explanations: typeof RECOMMENDATION_EXPLANATIONS
}

function comparePlanId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Score a single catalog plan for recommendation buckets.
 * `bestValueScore` (non-radio): newlyWatchableGames*2 + coveragePercent*0.3 - incrementalCost*0.5 - incrementalServices*3.
 *
 * When `nearTermIncremental` is provided, the newly-watchable term uses
 * `max(sample, near-term)` so Best Value can reflect the next week without discarding the sample schedule.
 */
export function scorePlanCandidate(
  summary: PlanCandidateSummary,
  incremental: IncrementalPlanValue,
  nearTermIncremental?: IncrementalPlanValue
): PlanCandidateScore {
  const isRadio = summary.tier === "radio"
  const cheapestEligible = !isRadio && summary.gamesWatchable > 0
  const fullCoverageEligible = !isRadio

  const newlyWatchableForScore =
    nearTermIncremental !== undefined
      ? Math.max(
          incremental.newlyWatchableGames,
          nearTermIncremental.newlyWatchableGames
        )
      : incremental.newlyWatchableGames

  const rawBestValue =
    newlyWatchableForScore * BV_WEIGHT_NEW_WATCHABLE +
    summary.coveragePercent * BV_WEIGHT_COVERAGE_PERCENT -
    incremental.incrementalCost * BV_PENALTY_INCREMENTAL_COST -
    incremental.incrementalServices.length * BV_PENALTY_INCREMENTAL_SERVICE

  const bestValueScore = isRadio ? BEST_VALUE_RADIO_FLOOR : round2(rawBestValue)

  return {
    cheapestEligible,
    fullCoverageEligible,
    bestValueScore,
  }
}

function pickCheapestPlanId(candidates: ScoredPlanCandidate[]): string | null {
  const pool = candidates.filter((c) => c.score.cheapestEligible)
  if (pool.length === 0) return null
  return pool.reduce((best, c) => {
    if (c.summary.monthlyCost < best.summary.monthlyCost) return c
    if (c.summary.monthlyCost > best.summary.monthlyCost) return best
    return comparePlanId(c.planId, best.planId) < 0 ? c : best
  }).planId
}

function pickBestScorer(pool: ScoredPlanCandidate[]): ScoredPlanCandidate | null {
  if (pool.length === 0) return null
  return pool.reduce((best, c) => {
    if (c.score.bestValueScore > best.score.bestValueScore) return c
    if (c.score.bestValueScore < best.score.bestValueScore) return best
    if (c.summary.gamesWatchable > best.summary.gamesWatchable) return c
    if (c.summary.gamesWatchable < best.summary.gamesWatchable) return best
    if (c.summary.monthlyCost < best.summary.monthlyCost) return c
    if (c.summary.monthlyCost > best.summary.monthlyCost) return best
    return comparePlanId(c.planId, best.planId) < 0 ? c : best
  })
}

/**
 * Best Value: max score among non-radio plans with catalog watchables ≥ 80% of Full Coverage’s.
 * Guardrail: if the top pick is Full and some cheaper plan costs ≥20% less while Full adds ≤10% more watchable games (vs Full’s total), pick next best instead.
 */
function pickBestValuePlanId(
  candidates: ScoredPlanCandidate[],
  fullCoveragePlanId: string | null
): string | null {
  const nonRadio = candidates.filter((c) => c.summary.tier !== "radio")
  if (nonRadio.length === 0) return null

  const fullEntry = fullCoveragePlanId
    ? candidates.find((c) => c.planId === fullCoveragePlanId)
    : null
  const fullWatchable = fullEntry?.summary.gamesWatchable ?? 0

  let pool = nonRadio
  if (fullCoveragePlanId && fullEntry && fullWatchable > 0) {
    const minWatchable = fullWatchable * BEST_VALUE_MIN_WATCHABLE_OF_FULL
    pool = nonRadio.filter((c) => c.summary.gamesWatchable >= minWatchable)
  }
  if (pool.length === 0) return null

  let winner = pickBestScorer(pool)
  if (!winner) return null

  if (
    fullCoveragePlanId &&
    winner.planId === fullCoveragePlanId &&
    fullEntry &&
    fullWatchable > 0
  ) {
    const blockFull = nonRadio.some((c) => {
      if (c.planId === fullCoveragePlanId) return false
      const costOk =
        fullEntry.summary.monthlyCost >= FULL_VS_OTHER_COST_RATIO * c.summary.monthlyCost
      const relGain =
        (fullEntry.summary.gamesWatchable - c.summary.gamesWatchable) /
        fullWatchable
      return costOk && relGain <= FULL_VS_OTHER_MAX_RELATIVE_WATCHABLE_GAIN
    })
    if (blockFull) {
      const poolNoFull = pool.filter((c) => c.planId !== fullCoveragePlanId)
      const alt = pickBestScorer(poolNoFull)
      if (alt) winner = alt
    }
  }

  return winner.planId
}

function pickFullCoveragePlanId(candidates: ScoredPlanCandidate[]): string | null {
  const pool = candidates.filter((c) => c.summary.tier !== "radio")
  if (pool.length === 0) return null
  return pool.reduce((best, c) => {
    if (c.summary.gamesWatchable > best.summary.gamesWatchable) return c
    if (c.summary.gamesWatchable < best.summary.gamesWatchable) return best
    if (c.summary.monthlyCost < best.summary.monthlyCost) return c
    if (c.summary.monthlyCost > best.summary.monthlyCost) return best
    return comparePlanId(c.planId, best.planId) < 0 ? c : best
  }).planId
}

const TIER_SORT_ORDER: Record<OptimizerPlan["tier"], number> = {
  cheapest: 0,
  value: 1,
  full: 2,
  radio: 3,
}

/**
 * Logic-driven labels per scope (does not read `plan.isBestValue` from catalog — that flag is still used in UI until wired).
 * `scoredCandidates` lists non–radio tiers first (cheapest → value → full), then Radio last.
 */
export function classifyRecommendedPlans(
  scope: OptimizerScope,
  userState: DemoUserState
): ClassifiedRecommendations {
  const plans = generatePlanCandidates(scope, userState)
  const nearTermNow = new Date()

  const scoredCandidates: ScoredPlanCandidate[] = plans.map((plan) => {
    const summary = summarizePlanCandidate(plan, userState)
    const incremental = calculateIncrementalPlanValue(plan, scope, userState)
    const nearTermIncremental = calculateNearTermIncrementalValue(
      plan,
      scope,
      userState,
      DEFAULT_NEAR_TERM_OPTIMIZER_DAYS,
      nearTermNow
    )
    const score = scorePlanCandidate(summary, incremental, nearTermIncremental)
    return { planId: plan.id, summary, incremental, nearTermIncremental, score }
  })

  scoredCandidates.sort((a, b) => {
    const ar = a.summary.tier === "radio" ? 1 : 0
    const br = b.summary.tier === "radio" ? 1 : 0
    if (ar !== br) return ar - br
    const td = TIER_SORT_ORDER[a.summary.tier] - TIER_SORT_ORDER[b.summary.tier]
    if (td !== 0) return td
    return comparePlanId(a.planId, b.planId)
  })

  const radioEntry = scoredCandidates.find((c) => c.summary.tier === "radio")
  const fullCoveragePlanId = pickFullCoveragePlanId(scoredCandidates)

  return {
    cheapestPlanId: pickCheapestPlanId(scoredCandidates),
    bestValuePlanId: pickBestValuePlanId(scoredCandidates, fullCoveragePlanId),
    fullCoveragePlanId,
    radioPlanId: radioEntry?.planId ?? null,
    scoredCandidates,
    explanations: RECOMMENDATION_EXPLANATIONS,
  }
}
