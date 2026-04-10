/**
 * Game Detail upgrade CTA: align `/plans/upgrade/...` with optimizer output for the relevant scope.
 */

import type { DemoUserState } from "@/lib/demo-user"
import { teamsForFollowedIds } from "@/lib/data"
import { classifyRecommendedPlans } from "@/lib/optimizer-engine"
import type { OptimizerScope } from "@/lib/optimizer-plans"
import type { Game } from "@/lib/types"
import { getUpgradeImpactIdForDestinationPlan } from "@/lib/upgrade-impact"

/** Optimizer scope for a game the user cares about (followed teams ∩ matchup). */
export function optimizerScopeForGame(
  game: Game,
  userState: DemoUserState
): OptimizerScope {
  const followIds = new Set(
    teamsForFollowedIds(userState.followedTeamIds).map((t) => t.id)
  )
  const involved = [game.homeTeam.id, game.awayTeam.id].filter((id) =>
    followIds.has(id)
  )
  if (involved.length >= 2) return "both"
  if (involved.includes("stl-blues")) return "blues"
  if (involved.includes("stl-cardinals")) return "cardinals"
  return "both"
}

/**
 * Upgrade Impact id that ends at the current Best Value catalog plan for `scope`, or `null` if none
 * (e.g. recommended tier is cheapest / no matching def).
 */
export function resolveGameDetailUpgradeImpactId(
  scope: OptimizerScope,
  userState: DemoUserState
): string | null {
  const rec = classifyRecommendedPlans(scope, userState)
  const target = rec.bestValuePlanId
  if (!target) return null
  return getUpgradeImpactIdForDestinationPlan(target) ?? null
}
