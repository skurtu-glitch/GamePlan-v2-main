import type { DemoUserState } from "@/lib/demo-user"
import type { Game } from "@/lib/types"
import { demoMonthlyPriceUsd, serviceDisplayName } from "@/lib/streaming-service-ids"

export type ResolvedGameAccessStatus = "watchable" | "listen-only" | "not-available"

export type ResolvedPrimaryActionType = "watch" | "listen" | "fix"

export interface ResolvedGameAccess {
  status: ResolvedGameAccessStatus
  primaryAction: {
    type: ResolvedPrimaryActionType
    label: string
  }
  providers: string[]
  reason?: string
  /** Single best upgrade hint for non-watchable states. */
  fixRecommendation?: string
}

const SEE_PLANS = "See Plans"

function videoProviderIds(game: Game): string[] {
  return game.watch.providers ?? []
}

function userCanWatchVideo(game: Game, userState: DemoUserState): boolean {
  const ids = videoProviderIds(game)
  if (ids.length === 0) return false
  return ids.some((id) => userState.connectedServiceIds.includes(id))
}

function missingVideoProviders(
  userState: DemoUserState,
  gameProviders: string[]
): string[] {
  return gameProviders.filter((id) => !userState.connectedServiceIds.includes(id))
}

/**
 * Cheapest missing unlock; ties broken by first appearance in game.watch.providers
 * (primary broadcast / catalog order for the matchup).
 */
function bestSingleFixRecommendation(game: Game, userState: DemoUserState): string {
  const orderedIds = videoProviderIds(game)
  const missing = missingVideoProviders(userState, orderedIds)

  if (missing.length === 0) {
    return SEE_PLANS
  }

  const priced = missing
    .map((id) => ({ id, price: demoMonthlyPriceUsd(id) }))
    .filter((x): x is { id: string; price: number } => x.price !== undefined)

  if (priced.length === 0) {
    return SEE_PLANS
  }

  const minPrice = Math.min(...priced.map((x) => x.price))
  const candidates = priced.filter((x) => x.price === minPrice).map((x) => x.id)

  const primaryId =
    candidates.length === 1
      ? candidates[0]
      : orderedIds.find((id) => candidates.includes(id)) ?? candidates[0]

  return `Add ${serviceDisplayName(primaryId)} to watch`
}

/**
 * Demo: radio feeds are always available for follow-along audio.
 */
function hasListenAccess(_game: Game, _userState: DemoUserState): boolean {
  return true
}

function listenProviderLabel(game: Game): string {
  return game.listen.provider ?? "Team radio"
}

function watchLabel(game: Game, userState: DemoUserState): string {
  const ids = videoProviderIds(game)
  const labelFromGame = game.watch.provider
  const met = ids.filter((id) => userState.connectedServiceIds.includes(id))

  if (labelFromGame && met.length > 0) {
    return `Watch on ${labelFromGame}`
  }
  const firstMet = met[0]
  if (firstMet) return `Watch on ${serviceDisplayName(firstMet)}`
  return "Watch now"
}

export function resolveGameAccess(game: Game, userState: DemoUserState): ResolvedGameAccess {
  const gameVideoIds = videoProviderIds(game)
  const canWatch = userCanWatchVideo(game, userState)
  const planCopy = "Not available with your current plan"

  if (canWatch) {
    const watchProviders = game.watch.provider ? [game.watch.provider] : []
    return {
      status: "watchable",
      primaryAction: {
        type: "watch",
        label: watchLabel(game, userState),
      },
      providers:
        watchProviders.length > 0
          ? watchProviders
          : gameVideoIds.map((id) => serviceDisplayName(id)),
    }
  }

  const listenOk = hasListenAccess(game, userState)

  if (listenOk) {
    const fixRecommendation =
      gameVideoIds.length > 0 ? bestSingleFixRecommendation(game, userState) : SEE_PLANS

    return {
      status: "listen-only",
      primaryAction: {
        type: "listen",
        label: `Listen on ${listenProviderLabel(game)}`,
      },
      providers: [listenProviderLabel(game)],
      reason: planCopy,
      fixRecommendation,
    }
  }

  return {
    status: "not-available",
    primaryAction: {
      type: "fix",
      label: "Fix access",
    },
    providers: [],
    reason: planCopy,
    fixRecommendation:
      gameVideoIds.length > 0 ? bestSingleFixRecommendation(game, userState) : SEE_PLANS,
  }
}
