import type { Team, StreamingPlan } from "./types"
import { DEFAULT_FOLLOWED_TEAM_IDS } from "./demo-user"
import { PROVIDER_LABEL, serviceDisplayName } from "./streaming-service-ids"
import { bindDemoSchedule } from "./data-sources/games"

export const teams: Team[] = [
  {
    id: "stl-blues",
    name: "Blues",
    city: "St. Louis",
    abbreviation: "STL",
    sport: "NHL",
    primaryColor: "#002F87",
    logo: "/teams/blues.svg",
  },
  {
    id: "stl-cardinals",
    name: "Cardinals",
    city: "St. Louis",
    abbreviation: "STL",
    sport: "MLB",
    primaryColor: "#C41E3A",
    logo: "/teams/cardinals.svg",
  },
  {
    id: "col-avalanche",
    name: "Avalanche",
    city: "Colorado",
    abbreviation: "COL",
    sport: "NHL",
    primaryColor: "#6F263D",
    logo: "/teams/avalanche.svg",
  },
  {
    id: "chi-cubs",
    name: "Cubs",
    city: "Chicago",
    abbreviation: "CHC",
    sport: "MLB",
    primaryColor: "#0E3386",
    logo: "/teams/cubs.svg",
  },
]

/** Map catalog ids to `Team` rows; unknown ids skipped. Preserves `ids` order. */
export function teamsForFollowedIds(ids: readonly string[]): Team[] {
  const byId = new Map(teams.map((t) => [t.id, t]))
  const out: Team[] = []
  const source =
    ids.length > 0 ? ids : (DEFAULT_FOLLOWED_TEAM_IDS as readonly string[])
  for (const id of source) {
    const row = byId.get(id)
    if (row) out.push(row)
  }
  return out
}

/**
 * Default followed teams for static call sites and legacy imports.
 * Prefer `teamsForFollowedIds(state.followedTeamIds)` in UI.
 */
export const userTeams = teamsForFollowedIds(DEFAULT_FOLLOWED_TEAM_IDS)

bindDemoSchedule(teams)

/** Canonical schedule rows: always call {@link getEngineGames} (no static re-export snapshot). */

export { getScheduleState } from "./schedule-client-bridge"

export {
  bindDemoSchedule,
  getDataFreshness,
  getDefaultGamesDataSource,
  getEngineGames,
  getGamesForTeams,
  getGamesInWindow,
  getLastScheduleValidation,
  getNormalizedSchedule,
  getUpcomingGames,
  toNormalizedGame,
} from "./data-sources/games"

export type {
  DataFreshness,
  ScheduleSourceUsed,
  ScheduleValidationSummary,
} from "./data-sources/games"

export type { GamesDataSource } from "./data-sources/games"
export type {
  NormalizedGame,
  NormalizedLeague,
  NormalizedTeamSide,
} from "./data-sources/types"

export const streamingPlans: StreamingPlan[] = [
  {
    id: "espn-plus",
    name: serviceDisplayName("espn-plus"),
    price: 10.99,
    priceUnit: "month",
    channels: [serviceDisplayName("espn-plus"), "ABC (select games)"],
    sports: ["NHL", "MLB", "NFL", "NBA"],
    pros: ["Out-of-market NHL games", "Affordable price"],
    cons: ["In-market restrictions apply", "No regional sports networks"],
  },
  {
    id: "fubo",
    name: "Fubo",
    price: 79.99,
    priceUnit: "month",
    channels: [PROVIDER_LABEL.FANDUEL_RSN, "ESPN", "FS1", "NBC Sports"],
    sports: ["NHL", "MLB", "NFL", "NBA"],
    pros: ["Regional sports networks", "DVR included"],
    cons: ["Higher price", "Some markets excluded"],
  },
  {
    id: "mlb-tv",
    name: serviceDisplayName("mlb-tv"),
    price: 149.99,
    priceUnit: "year",
    channels: ["All out-of-market MLB games"],
    sports: ["MLB"],
    pros: ["Every out-of-market game", "Multi-device streaming"],
    cons: ["In-market viewing rules apply", "MLB only"],
  },
]
