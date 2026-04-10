/**
 * Demo market / region model for location-aware access rules.
 * One code per “home broadcast market” — not a full DMA map.
 */

import type { DemoLocation } from "@/lib/demo-user"
import type { Game } from "@/lib/types"

/** Canonical home-market codes used in blackout heuristics. */
export type HomeMarketCode = "stl" | "den" | "chi"

/** Maps team id → home market (see `lib/data` teams). */
export const TEAM_HOME_MARKET: Readonly<Record<string, HomeMarketCode>> = {
  "stl-blues": "stl",
  "stl-cardinals": "stl",
  "col-avalanche": "den",
  "chi-cubs": "chi",
}

export function homeMarketsForGame(game: Game): HomeMarketCode[] {
  const a = TEAM_HOME_MARKET[game.homeTeam.id]
  const b = TEAM_HOME_MARKET[game.awayTeam.id]
  const out: HomeMarketCode[] = []
  if (a) out.push(a)
  if (b && b !== a) out.push(b)
  return out
}

/** Home team’s broadcast market when mapped; used for conservative blackout heuristics. */
export function homeTeamMarketCode(game: Game): HomeMarketCode | null {
  return TEAM_HOME_MARKET[game.homeTeam.id] ?? null
}

/**
 * User is treated as “in the home market” only when their resolved market matches the **home**
 * team’s market (venue / primary local RSN territory). Away-team cities alone do not trigger
 * in-market national stripping.
 */
export function isUserInHomeTeamMarket(
  game: Game,
  userMarket: HomeMarketCode | null
): boolean {
  if (userMarket === null) return false
  const hm = homeTeamMarketCode(game)
  return hm !== null && hm === userMarket
}

/** When false, skip market-based video filtering for this game (unknown venue market). */
export function hasMappedHomeTeamMarket(game: Game): boolean {
  return homeTeamMarketCode(game) !== null
}

const KNOWN_REGION_CODES = new Set<string>(["stl", "den", "chi"])

/**
 * Resolve user home market from explicit region, ZIP heuristics, or city/state.
 * Returns null when unknown — callers must skip market rules (trust-safe).
 */
export function resolveUserHomeMarket(location: DemoLocation): HomeMarketCode | null {
  const rc = location.regionCode?.trim().toLowerCase()
  if (rc && KNOWN_REGION_CODES.has(rc)) {
    return rc as HomeMarketCode
  }

  const zip = location.zipCode?.trim()
  if (zip) {
    const prefix3 = zip.slice(0, 3)
    // Very rough US prefixes for demo teams only; unknown ZIP → do not guess.
    if (prefix3 === "631" || prefix3 === "630" || prefix3 === "633") return "stl"
    if (prefix3 === "800" || prefix3 === "801" || prefix3 === "802" || prefix3 === "805") {
      return "den"
    }
    if (
      prefix3 === "606" ||
      prefix3 === "607" ||
      prefix3 === "608" ||
      prefix3 === "600" ||
      prefix3 === "601"
    ) {
      return "chi"
    }
  }

  const state = location.state?.trim().toUpperCase() ?? ""
  const city = location.city?.trim().toLowerCase() ?? ""

  if (state === "MO" && (city.includes("st. louis") || city.includes("st louis"))) {
    return "stl"
  }
  if (state === "CO" || city.includes("denver") || city.includes("boulder")) {
    return "den"
  }
  if (state === "IL" && (city.includes("chicago") || city.includes("cook"))) {
    return "chi"
  }

  return null
}
