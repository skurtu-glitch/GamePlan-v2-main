import type { DemoUserState } from "@/lib/demo-user"
import type { Game } from "@/lib/types"
import { serviceDisplayName } from "@/lib/streaming-service-ids"
import {
  ACCESS_RULES_SEE_PLANS,
  buildBestSingleFixRecommendation,
  buildWatchPrimaryLabel,
  evaluateAudioAccess,
  evaluateVideoAccess,
  videoProviderIdsOrdered,
} from "@/lib/access-rules"

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

const PLAN_COPY = "Not available with your current plan"

/**
 * Shared resolver entrypoint. Delegates entitlement + feed rules to `lib/access-rules.ts`;
 * maps outcomes into product-facing {@link ResolvedGameAccess}.
 */
export function resolveGameAccess(game: Game, userState: DemoUserState): ResolvedGameAccess {
  const video = evaluateVideoAccess(game, userState)
  const gameVideoIds = videoProviderIdsOrdered(game)
  const audio = evaluateAudioAccess(game, userState)

  if (video.canWatch) {
    const watchProviders = game.watch.provider ? [game.watch.provider] : []
    return {
      status: "watchable",
      primaryAction: {
        type: "watch",
        label: buildWatchPrimaryLabel(game, userState, video.matchedServiceIds),
      },
      providers:
        watchProviders.length > 0
          ? watchProviders
          : gameVideoIds.map((id) => serviceDisplayName(id)),
    }
  }

  if (audio.available) {
    const fixRecommendation =
      gameVideoIds.length > 0
        ? buildBestSingleFixRecommendation(game, userState)
        : ACCESS_RULES_SEE_PLANS

    return {
      status: "listen-only",
      primaryAction: {
        type: "listen",
        label: `Listen on ${audio.providerLabel}`,
      },
      providers: [audio.providerLabel],
      reason: PLAN_COPY,
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
    reason: PLAN_COPY,
    fixRecommendation:
      gameVideoIds.length > 0
        ? buildBestSingleFixRecommendation(game, userState)
        : ACCESS_RULES_SEE_PLANS,
  }
}
