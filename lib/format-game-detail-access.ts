import {
  describeWatchProviderRow,
  evaluateVideoAccess,
  marketHeuristicsActive,
  missingVideoProviders,
  videoProviderIdsViableForLocation,
} from "@/lib/access-rules"
import { teamsForFollowedIds } from "@/lib/data"
import type { DemoUserState } from "@/lib/demo-user"
import type { Game, WatchOption } from "@/lib/types"
import {
  isGameWithinHours,
  missTonightUrgencyLine,
  seasonUnlockBanner,
  urgencyTeamLabel,
  URGENCY_HOURS,
} from "@/lib/conversion-copy"
import { demoMonthlyPriceUsd, serviceDisplayName } from "@/lib/streaming-service-ids"
import type { ResolvedGameAccess } from "@/lib/resolve-game-access"

export interface FormattedWatchVerdict {
  canWatch: boolean
  summary: string
  reasons: string[]
}

export interface FormattedBestOption {
  type: "watch" | "listen"
  provider: string
  explanation: string
  /**
   * First entitled video service id in `game.watch.providers` order when watchable.
   * Omitted when the game has no id list but video still resolves (rare); use demo stub path.
   */
  primaryWatchServiceId?: string
}

export interface FormattedGameDetailAccess {
  bestOption: FormattedBestOption
  watchVerdict: FormattedWatchVerdict
  watchOptions: WatchOption[]
  whyThisAnswer: string[]
  /**
   * Conversion banner: near-term game → miss-tonight line; otherwise season unlock line.
   * Presentation-only (same data as Assistant urgency layer).
   */
  conversionHook: string
}

function videoIds(game: Game): string[] {
  return game.watch.providers ?? []
}

function joinLabels(ids: string[]): string {
  const labels = ids.map(serviceDisplayName)
  if (labels.length <= 1) return labels[0] ?? ""
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`
}

function listenProvider(game: Game): string {
  return game.listen.provider ?? "team radio"
}

function stripListenPrefixSafe(label: string, game: Game): string {
  const s = label.replace(/^Listen on\s+/i, "").trim()
  return s || listenProvider(game)
}

function stripWatchPrefix(label: string): string {
  return label.replace(/^Watch on\s+/i, "").trim()
}

function buildWatchOptions(
  game: Game,
  userState: DemoUserState,
  resolved: ResolvedGameAccess
): WatchOption[] {
  const ids = videoIds(game)
  const videoEval = evaluateVideoAccess(game, userState)

  if (ids.length === 0) {
    const label = game.watch.provider ?? "Regional / national feed"
    const canWatch = resolved.status === "watchable"
    return [
      {
        provider: label,
        available: canWatch,
        reason: canWatch
          ? marketHeuristicsActive(game, userState)
            ? "Included with your connected services — this feed still qualifies after your saved home-market rules."
            : "Included with your connected services for this game’s listed feeds."
          : "Not available with your current plan — add in Connected Services",
        hasSubscription: canWatch,
      },
    ]
  }

  return ids.map((id) => {
    const row = describeWatchProviderRow(game, userState, id, videoEval)
    const priceUsd = demoMonthlyPriceUsd(id)
    return {
      provider: serviceDisplayName(id),
      serviceId: id,
      available: row.canOpenWatch,
      reason: row.reason,
      hasSubscription: row.subscribed,
      price:
        !row.subscribed && priceUsd !== undefined
          ? `$${priceUsd.toFixed(2)}/mo`
          : undefined,
    }
  })
}

function buildWatchVerdict(
  game: Game,
  resolved: ResolvedGameAccess,
  userState: DemoUserState
): FormattedWatchVerdict {
  const ids = videoIds(game)
  const carrierLine =
    ids.length > 0
      ? `This game's video is tied to: ${joinLabels(ids)}.`
      : game.watch.provider
        ? `Listed video provider: ${game.watch.provider}.`
        : "No streaming provider mapping is on file for this matchup."

  if (resolved.status === "watchable") {
    const reasons: string[] = [
      carrierLine,
      marketHeuristicsActive(game, userState)
        ? "Your Connected Services include at least one listed feed that still qualifies after your saved ZIP/city/state home-market rules."
        : "Your Connected Services include at least one provider that matches this game’s listed feeds (regional market rules are off or your market couldn’t be inferred).",
    ]
    if (game.watch.note) reasons.push(game.watch.note)
    reasons.push(`Audio: you can still follow on ${listenProvider(game)}.`)
    return {
      canWatch: true,
      summary: "Video is available with your current plan for this matchup.",
      reasons,
    }
  }

  if (resolved.status === "listen-only") {
    const reasons: string[] = [
      resolved.reason ?? "Video is not available with your current plan for this matchup.",
      carrierLine,
      `You can follow live audio on ${listenProvider(game)}.`,
    ]
    const viableIds = videoProviderIdsViableForLocation(game, userState)
    const missing = missingVideoProviders(userState, viableIds)
    if (missing.length > 0) {
      reasons.push(
        `To watch, add one of: ${joinLabels(missing)} (see Connected Services or Plans).`
      )
    }
    return {
      canWatch: false,
      summary: resolved.reason ?? "Video is not available with your current plan.",
      reasons,
    }
  }

  return {
    canWatch: false,
    summary: resolved.reason ?? "Video is not available with your current plan.",
    reasons: [
      carrierLine,
      "We could not match this game to a watch path under your current Connected Services.",
      resolved.fixRecommendation
        ? `${resolved.fixRecommendation}.`
        : "Compare plans or add a service that carries this feed.",
    ],
  }
}

function buildBestOption(
  game: Game,
  resolved: ResolvedGameAccess,
  userState: DemoUserState
): FormattedBestOption {
  if (resolved.status === "watchable") {
    const fromAction = stripWatchPrefix(resolved.primaryAction.label)
    const provider = fromAction || game.watch.provider || joinLabels(videoIds(game)) || "your app"
    const video = evaluateVideoAccess(game, userState)
    const met = video.matchedServiceIds
    const primaryWatchServiceId = met[0]
    return {
      type: "watch",
      provider,
      explanation: `${resolved.primaryAction.label}. Add or change services anytime from Connected Services.`,
      ...(primaryWatchServiceId ? { primaryWatchServiceId } : {}),
    }
  }

  const listenName = stripListenPrefixSafe(resolved.primaryAction.label, game)
  const fix = resolved.fixRecommendation
    ? ` ${resolved.fixRecommendation}.`
    : ""

  return {
    type: "listen",
    provider: listenName,
    explanation: `Video is not available with your current plan, so the best way to follow live is audio on ${listenName}.${fix}`,
  }
}

function followedTeamIdSet(userState: DemoUserState): Set<string> {
  return new Set(teamsForFollowedIds(userState.followedTeamIds).map((t) => t.id))
}

function buildConversionHook(game: Game, userState: DemoUserState, now: Date): string {
  if (isGameWithinHours(game.dateTime, URGENCY_HOURS, now)) {
    return missTonightUrgencyLine(urgencyTeamLabel(game, followedTeamIdSet(userState)))
  }
  return seasonUnlockBanner()
}

function buildWhyThisAnswer(
  game: Game,
  resolved: ResolvedGameAccess,
  userState: DemoUserState
): string[] {
  const ids = videoIds(game)
  const bullets: string[] = [
    "We compare this game's broadcaster list to your Connected Services — the same check as Home.",
  ]

  if (resolved.status === "watchable") {
    const video = evaluateVideoAccess(game, userState)
    const met = video.matchedServiceIds
    if (met.length > 0) {
      bullets.push(
        `Watch works because you have ${joinLabels(met)} connected for video.`
      )
    }
    bullets.push(`${resolved.primaryAction.label} is the shortest path to start video.`)
  } else {
    bullets.push(resolved.reason ?? "Video is not available with your current plan.")
    if (ids.length > 0) {
      const viable = videoProviderIdsViableForLocation(game, userState)
      const missing = missingVideoProviders(userState, viable)
      if (missing.length > 0) {
        bullets.push(
          `You're missing video entitlement for: ${joinLabels(missing)}.`
        )
      }
    }
    bullets.push(
      `Listen stays available on ${listenProvider(game)} while you decide on upgrades.`
    )
    if (resolved.fixRecommendation) {
      bullets.push(`${resolved.fixRecommendation} — open Connected Services or Plans to act on it.`)
    }
  }

  return bullets
}

export function formatGameDetailAccess(
  game: Game,
  resolved: ResolvedGameAccess,
  userState: DemoUserState,
  now: Date = new Date()
): FormattedGameDetailAccess {
  return {
    bestOption: buildBestOption(game, resolved, userState),
    watchVerdict: buildWatchVerdict(game, resolved, userState),
    watchOptions: buildWatchOptions(game, userState, resolved),
    whyThisAnswer: buildWhyThisAnswer(game, resolved, userState),
    conversionHook: buildConversionHook(game, userState, now),
  }
}
