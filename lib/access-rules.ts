/**
 * MVP access rules: separates entitlement checks and feed classification from {@link resolveGameAccess}.
 * Deterministic; extend blackouts / market rules here without changing UI call sites.
 */

import type { DemoUserState } from "@/lib/demo-user"
import type { Game } from "@/lib/types"
import {
  hasMappedHomeTeamMarket,
  homeTeamMarketCode,
  isUserInHomeTeamMarket,
  resolveUserHomeMarket,
} from "@/lib/market-regions"
import { demoMonthlyPriceUsd, serviceDisplayName } from "@/lib/streaming-service-ids"

export const ACCESS_RULES_SEE_PLANS = "See Plans"

/** League / national-style streaming SKUs in the demo catalog. */
const NATIONAL_VIDEO_SERVICES = new Set<string>(["espn-plus", "max", "mlb-tv", "nhl-tv"])

/** Pure RSN-style SKUs (local rights emphasis). */
const REGIONAL_VIDEO_SERVICES = new Set<string>(["fanduel-sports"])

/** vMVPD / bundle SKUs — not stripped like pure RSNs when out-of-market. */
const BUNDLE_VIDEO_SERVICES = new Set<string>(["youtube-tv", "directv"])

export type VideoProviderKind = "national" | "regional" | "bundle" | "unknown"

export function videoProviderIdsOrdered(game: Game): string[] {
  return game.watch.providers ?? []
}

/** When regional rules are disabled, behave like an unknown market (existing code paths, no rule changes). */
function effectiveUserHomeMarket(userState: DemoUserState) {
  if (!userState.preferences.regionalLocationEnabled) return null
  return resolveUserHomeMarket(userState.location)
}

/**
 * True when we have both a resolved user market and a mapped home-team market for this game —
 * i.e. regional heuristics may change outcomes beyond raw entitlements.
 */
export function marketHeuristicsActive(game: Game, userState: DemoUserState): boolean {
  return (
    effectiveUserHomeMarket(userState) !== null && hasMappedHomeTeamMarket(game)
  )
}

export function userEntitledToService(userState: DemoUserState, serviceId: string): boolean {
  return userState.connectedServiceIds.includes(serviceId)
}

export function classifyVideoProviderKind(serviceId: string): VideoProviderKind {
  if (NATIONAL_VIDEO_SERVICES.has(serviceId)) return "national"
  if (REGIONAL_VIDEO_SERVICES.has(serviceId)) return "regional"
  if (BUNDLE_VIDEO_SERVICES.has(serviceId)) return "bundle"
  return "unknown"
}

export interface VideoBlackoutEvaluation {
  /** When true, treat linear video as blocked even if the user holds a matching entitlement. */
  applies: boolean
  /** User-facing context when `applies` is true (or when market rules removed all matches). */
  reason?: string
}

/**
 * League- or feed-specific blackouts beyond market/national-vs-RSN (none yet).
 * Location-aware rules run in {@link evaluateVideoAccess} via market filtering.
 */
export function evaluateVideoBlackoutRules(
  _game: Game,
  _userState: DemoUserState
): VideoBlackoutEvaluation {
  return { applies: false }
}

export interface VideoAccessEvaluation {
  canWatch: boolean
  /** Service ids the user has that count as watchable after market / blackout rules. */
  matchedServiceIds: string[]
  orderedProviderIds: string[]
  blackoutRestricted: boolean
  satisfiedViaNational: boolean
  satisfiedViaRegional: boolean
  /**
   * When the user’s entitlements matched raw providers but none survive in-market / out-of-market
   * filtering — explains why video is not available despite subscriptions.
   */
  marketRestrictionMessage?: string
}

/**
 * Provider ids on the game that are realistic for this user’s location (for “add X” hints).
 * When location is unknown, returns the full ordered list (no extra filtering).
 */
export function videoProviderIdsViableForLocation(
  game: Game,
  userState: DemoUserState
): string[] {
  const ordered = videoProviderIdsOrdered(game)
  const userMarket = effectiveUserHomeMarket(userState)
  if (userMarket === null || !hasMappedHomeTeamMarket(game)) {
    return ordered
  }
  const inHomeMarket = isUserInHomeTeamMarket(game, userMarket)
  if (inHomeMarket) {
    return ordered.filter((id) => classifyVideoProviderKind(id) !== "national")
  }
  return ordered.filter((id) => classifyVideoProviderKind(id) !== "regional")
}

function applyMarketAwareMatchedFilter(
  game: Game,
  userState: DemoUserState,
  matchedServiceIds: readonly string[]
): { effective: string[]; message?: string } {
  const userMarket = effectiveUserHomeMarket(userState)
  if (
    userMarket === null ||
    !hasMappedHomeTeamMarket(game) ||
    matchedServiceIds.length === 0
  ) {
    return { effective: [...matchedServiceIds] }
  }

  const inHomeMarket = isUserInHomeTeamMarket(game, userMarket)

  if (inHomeMarket) {
    const effective = matchedServiceIds.filter(
      (id) => classifyVideoProviderKind(id) !== "national"
    )
    if (matchedServiceIds.length > 0 && effective.length === 0) {
      return {
        effective,
        message:
          "Regional coverage applies for this game. National streaming is often limited in the home broadcast area for matchups like this.",
      }
    }
    return { effective }
  }

  const effective = matchedServiceIds.filter(
    (id) => classifyVideoProviderKind(id) !== "regional"
  )
  if (matchedServiceIds.length > 0 && effective.length === 0) {
    return {
      effective,
      message:
        "This game is likely unavailable on this service in your area. Regional networks usually focus on the home broadcast market rather than where you’re watching from.",
    }
  }
  return { effective }
}

/**
 * Row-level Game Detail copy: aligns with {@link evaluateVideoAccess} (same market rules).
 */
export function describeWatchProviderRow(
  game: Game,
  userState: DemoUserState,
  serviceId: string,
  video: VideoAccessEvaluation
): { canOpenWatch: boolean; subscribed: boolean; reason: string } {
  const subscribed = userEntitledToService(userState, serviceId)
  const canOpenWatch = video.matchedServiceIds.includes(serviceId)

  if (canOpenWatch) {
    return {
      canOpenWatch: true,
      subscribed: true,
      reason: marketHeuristicsActive(game, userState)
        ? "Included with your connected services — this feed still qualifies after your saved home-market rules."
        : "Included with your connected services for this game’s listed feeds.",
    }
  }

  if (!subscribed) {
    return {
      canOpenWatch: false,
      subscribed: false,
      reason: "Not available with your current plan — add in Connected Services",
    }
  }

  const kind = classifyVideoProviderKind(serviceId)
  const userMarket = effectiveUserHomeMarket(userState)
  const hm = homeTeamMarketCode(game)
  const rulesApply = userMarket !== null && hm !== null
  const inHomeMarket = rulesApply && isUserInHomeTeamMarket(game, userMarket)

  let reason: string
  if (!rulesApply) {
    reason = `You have ${serviceDisplayName(serviceId)}, but it isn’t unlocking this feed for this game with the info we have—try another listed option or Connected Services.`
  } else if (inHomeMarket && kind === "national") {
    reason = `You have ${serviceDisplayName(serviceId)}, but regional coverage applies for this game—national feeds are often limited in the home broadcast area.`
  } else if (!inHomeMarket && kind === "regional") {
    reason = `You have ${serviceDisplayName(serviceId)}, but this game is likely unavailable on this service in your area—regional networks usually target the home market.`
  } else if (inHomeMarket && kind === "bundle") {
    reason = `You have ${serviceDisplayName(serviceId)}, but this game isn’t available on that path here—check the provider for local channel availability.`
  } else {
    reason = `You have ${serviceDisplayName(serviceId)}, but it isn’t a valid watch path for this game in your situation right now.`
  }

  return { canOpenWatch: false, subscribed: true, reason }
}

export function evaluateVideoAccess(game: Game, userState: DemoUserState): VideoAccessEvaluation {
  const orderedProviderIds = videoProviderIdsOrdered(game)
  const rawMatched = orderedProviderIds.filter((id) => userEntitledToService(userState, id))
  const { effective: matchedServiceIds, message: marketRestrictionMessage } =
    applyMarketAwareMatchedFilter(game, userState, rawMatched)

  const hasProviderList = orderedProviderIds.length > 0
  const leagueBlackout = evaluateVideoBlackoutRules(game, userState)
  const blackoutRestricted =
    Boolean(leagueBlackout.applies) ||
    (rawMatched.length > 0 && matchedServiceIds.length === 0 && marketRestrictionMessage !== undefined)

  const canWatch =
    hasProviderList &&
    matchedServiceIds.length > 0 &&
    !leagueBlackout.applies

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
    marketRestrictionMessage,
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
  const orderedIds = videoProviderIdsViableForLocation(game, userState)
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
