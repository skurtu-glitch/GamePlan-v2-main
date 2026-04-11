/**
 * Demo market / region model for location-aware access rules.
 * One code per “home broadcast market” — not a full DMA map.
 */

import type { DemoLocation } from "@/lib/demo-user"
import type { Game } from "@/lib/types"

/** Canonical home-market codes used in blackout heuristics. */
export type HomeMarketCode =
  | "stl"
  | "den"
  | "chi"
  | "ny"
  | "dal"
  | "pit"
  | "cin"
  | "mil"

/** Maps team id → home market (see `lib/data` teams). */
export const TEAM_HOME_MARKET: Readonly<Record<string, HomeMarketCode>> = {
  "stl-blues": "stl",
  "stl-cardinals": "stl",
  "chi-blackhawks": "chi",
  "chi-cubs": "chi",
  "ny-rangers": "ny",
  "dal-stars": "dal",
  "col-avalanche": "den",
  "pit-pirates": "pit",
  "cin-reds": "cin",
  "mil-brewers": "mil",
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

const KNOWN_REGION_CODES = new Set<string>([
  "stl",
  "den",
  "chi",
  "ny",
  "dal",
  "pit",
  "cin",
  "mil",
])

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
    if (
      prefix3 === "100" ||
      prefix3 === "101" ||
      prefix3 === "102" ||
      prefix3 === "103" ||
      prefix3 === "104" ||
      prefix3 === "112" ||
      prefix3 === "113"
    ) {
      return "ny"
    }
    if (prefix3 === "752" || prefix3 === "750" || prefix3 === "751") return "dal"
    if (prefix3 === "152" || prefix3 === "151" || prefix3 === "153") return "pit"
    if (prefix3 === "452" || prefix3 === "450" || prefix3 === "451") return "cin"
    if (prefix3 === "532" || prefix3 === "530" || prefix3 === "531") return "mil"
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
  if (
    state === "NY" &&
    (city.includes("new york") || city.includes("brooklyn") || city.includes("queens"))
  ) {
    return "ny"
  }
  if (state === "TX" && city.includes("dallas")) return "dal"
  if (state === "PA" && city.includes("pittsburgh")) return "pit"
  if (state === "OH" && city.includes("cincinnati")) return "cin"
  if (state === "WI" && city.includes("milwaukee")) return "mil"

  return null
}

/** User-facing area label for Settings / copy only (does not affect {@link resolveUserHomeMarket}). */
export function homeMarketAreaLabel(code: HomeMarketCode): string {
  switch (code) {
    case "stl":
      return "St. Louis area"
    case "den":
      return "Denver area"
    case "chi":
      return "Chicago area"
    case "ny":
      return "New York area"
    case "dal":
      return "Dallas area"
    case "pit":
      return "Pittsburgh area"
    case "cin":
      return "Cincinnati area"
    case "mil":
      return "Milwaukee area"
  }
}
