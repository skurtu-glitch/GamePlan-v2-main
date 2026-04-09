/**
 * MVP access rules: separates entitlement checks and feed classification from {@link resolveGameAccess}.
 * Deterministic; extend blackouts / market rules here without changing UI call sites.
 */

import type { DemoUserState } from "@/lib/demo-user"
import type { Game } from "@/lib/types"
import { demoMonthlyPriceUsd, serviceDisplayName } from "@/lib/streaming-service-ids"

export const ACCESS_RULES_SEE_PLANS = "See Plans"

/** League / national-style streaming SKUs in the demo catalog. */
const NATIONAL_VIDEO_SERVICES = new Set<string>(["espn-plus", "max", "mlb-tv"])

/** RSN + vMVPD-style SKUs treated as local / regional for rule bucketing. */
const REGIONAL_VIDEO_SERVICES = new Set<string>(["fanduel-sports", "youtube-tv", "directv"])

export type VideoProviderKind = "national" | "regional" | "unknown"

export function videoProviderIdsOrdered(game: Game): string[] {
  return game.watch.providers ?? []
}

export function userEntitledToService(userState: DemoUserState, serviceId: string): boolean {
  return userState.connectedServiceIds.includes(serviceId)
}

export function classifyVideoProviderKind(serviceId: string): VideoProviderKind {
  if (NATIONAL_VIDEO_SERVICES.has(serviceId)) return "national"
  if (REGIONAL_VIDEO_SERVICES.has(serviceId)) return "regional"
  return "unknown"
}

export interface VideoBlackoutEvaluation {
  /** When true, treat linear video as blocked even if the user holds a matching entitlement. */
  applies: boolean
  /** MVP placeholder copy; unused while `applies` is false. */
  reason?: string
}

/**
 * MVP: no league blackout modeling. `Game.watch.status` / notes are not applied here so behavior
 * matches the pre–access-rules resolver (pure entitlement intersection on listed SKUs).
 */
export function evaluateVideoBlackoutRules(
  _game: Game,
  _userState: DemoUserState
): VideoBlackoutEvaluation {
  return { applies: false }
}

export interface VideoAccessEvaluation {
  canWatch: boolean
  matchedServiceIds: string[]
  orderedProviderIds: string[]
  blackoutRestricted: boolean
  satisfiedViaNational: boolean
  satisfiedViaRegional: boolean
}

export function evaluateVideoAccess(game: Game, userState: DemoUserState): VideoAccessEvaluation {
  const orderedProviderIds = videoProviderIdsOrdered(game)
  const matchedServiceIds = orderedProviderIds.filter((id) => userEntitledToService(userState, id))
  const hasProviderList = orderedProviderIds.length > 0
  const entitledMatch = matchedServiceIds.length > 0
  const blackout = evaluateVideoBlackoutRules(game, userState)
  const blackoutRestricted = Boolean(blackout.applies)
  const canWatch = hasProviderList && entitledMatch && !blackoutRestricted

  const satisfiedViaNational = matchedServiceIds.some(
    (id) => classifyVideoProviderKind(id) === "national"
  )
  const satisfiedViaRegional = matchedServiceIds.some(
    (id) => classifyVideoProviderKind(id) === "regional"
  )

  return {
    canWatch,
    matchedServiceIds,
    orderedProviderIds,
    blackoutRestricted,
    satisfiedViaNational,
    satisfiedViaRegional,
  }
}

export interface AudioAccessEvaluation {
  available: boolean
  providerLabel: string
}

/**
 * Demo: national/RSN audio policy is not modeled; treat team/listen feed as reachable whenever
 * the game exposes a listen row (resolver still branches on this for UX).
 */
export function evaluateAudioAccess(game: Game, _userState: DemoUserState): AudioAccessEvaluation {
  return {
    available: true,
    providerLabel: game.listen.provider ?? "Team radio",
  }
}

export function missingVideoProviders(
  userState: DemoUserState,
  gameProviders: string[]
): string[] {
  return gameProviders.filter((id) => !userEntitledToService(userState, id))
}

/**
 * Cheapest missing unlock; ties broken by first appearance in `game.watch.providers`.
 */
export function buildBestSingleFixRecommendation(game: Game, userState: DemoUserState): string {
  const orderedIds = videoProviderIdsOrdered(game)
  const missing = missingVideoProviders(userState, orderedIds)

  if (missing.length === 0) {
    return ACCESS_RULES_SEE_PLANS
  }

  const priced = missing
    .map((id) => ({ id, price: demoMonthlyPriceUsd(id) }))
    .filter((x): x is { id: string; price: number } => x.price !== undefined)

  if (priced.length === 0) {
    return ACCESS_RULES_SEE_PLANS
  }

  const minPrice = Math.min(...priced.map((x) => x.price))
  const candidates = priced.filter((x) => x.price === minPrice).map((x) => x.id)

  const primaryId =
    candidates.length === 1
      ? candidates[0]
      : orderedIds.find((id) => candidates.includes(id)) ?? candidates[0]

  return `Add ${serviceDisplayName(primaryId)} to watch`
}

export function buildWatchPrimaryLabel(
  game: Game,
  _userState: DemoUserState,
  matchedServiceIds: string[]
): string {
  const labelFromGame = game.watch.provider
  const met = matchedServiceIds

  if (labelFromGame && met.length > 0) {
    return `Watch on ${labelFromGame}`
  }
  const firstMet = met[0]
  if (firstMet) return `Watch on ${serviceDisplayName(firstMet)}`
  return "Watch now"
}
