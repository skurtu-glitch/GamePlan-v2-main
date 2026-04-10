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
  "mlb-national-espn-plus": {
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
  "nhl-oom-nhl-tv": {
    status: "partial",
    provider: PROVIDER_LABEL.NHL_TV,
    providers: ["nhl-tv"],
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

/** Demo listen label by team id (home/away priority: first match wins). */
const DEMO_LISTEN_LABEL_BY_TEAM_ID: Record<string, string> = {
  "stl-blues": LISTEN_FEED.BLUES_AM,
  "stl-cardinals": LISTEN_FEED.CARDINALS_AM,
  "col-avalanche": "Altitude Radio",
  "chi-cubs": "670 The Score",
  "chi-blackhawks": "Blackhawks Audio Network",
  "ny-rangers": "Rangers Radio",
  "dal-stars": "Stars Radio",
  "pit-pirates": "Pirates Radio",
  "cin-reds": "Reds Radio",
  "mil-brewers": "Brewers Radio",
}

/**
 * Listen feed label (not a subscription id) — catalog-driven; STL flagship feeds preserved for Blues/Cardinals.
 */
export function listenLabelForGame(homeTeamId: string, awayTeamId: string): string {
  for (const id of [homeTeamId, awayTeamId]) {
    const label = DEMO_LISTEN_LABEL_BY_TEAM_ID[id]
    if (label) return label
  }
  return "Team radio"
}
