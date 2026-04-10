/**
 * Config-driven broadcast / rights hints for normalized games.
 * Maps to canonical `connectedServiceIds` / `game.watch.providers` used by the resolver.
 */

import type { MediaAvailability } from "@/lib/types"
import { LISTEN_FEED, PROVIDER_LABEL } from "@/lib/streaming-service-ids"
import type { BroadcastProfileId } from "@/lib/data-sources/schedule/types"

export interface WatchMapping {
  status: MediaAvailability["status"]
  provider: string
  providers: string[]
  note?: string
}

const PROFILES: Record<BroadcastProfileId, WatchMapping> = {
  "nhl-national-espn-plus": {
    status: "available",
    provider: PROVIDER_LABEL.ESPN_PLUS,
    providers: ["espn-plus"],
  },
  "mlb-rsn-fanduel-unavailable": {
    status: "unavailable",
    provider: PROVIDER_LABEL.FANDUEL_RSN,
    providers: ["fanduel-sports"],
    note: "Not available with your current plan",
  },
  "nhl-national-max": {
    status: "available",
    provider: PROVIDER_LABEL.MAX,
    providers: ["max"],
  },
  "mlb-oom-mlb-tv": {
    status: "partial",
    provider: PROVIDER_LABEL.MLB_TV,
    providers: ["mlb-tv"],
    note: "Out-of-market only",
  },
  "nhl-rsn-fanduel-available": {
    status: "available",
    provider: PROVIDER_LABEL.FANDUEL_RSN,
    providers: ["fanduel-sports"],
  },
}

export function watchMappingForProfile(profile: BroadcastProfileId): WatchMapping {
  return PROFILES[profile]
}

/**
 * Listen feed label (not a subscription id) — matches legacy demo rows (STL teams keep flagship feeds).
 */
export function listenLabelForGame(homeTeamId: string, awayTeamId: string): string {
  if (homeTeamId === "stl-blues" || awayTeamId === "stl-blues") {
    return LISTEN_FEED.BLUES_AM
  }
  if (homeTeamId === "stl-cardinals" || awayTeamId === "stl-cardinals") {
    return LISTEN_FEED.CARDINALS_AM
  }
  if (homeTeamId === "col-avalanche" || awayTeamId === "col-avalanche") {
    return "Altitude Radio"
  }
  if (homeTeamId === "chi-cubs" || awayTeamId === "chi-cubs") {
    return "670 The Score"
  }
  return "Team radio"
}
