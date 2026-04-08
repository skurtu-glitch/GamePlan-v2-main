/**
 * Canonical streaming service ids: Connected Services, game.watch.providers,
 * optimizer plans, and resolveGameAccess must use these keys.
 */
export const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "espn-plus": "ESPN+",
  max: "Max",
  "fanduel-sports": "FanDuel Sports Network",
  "mlb-tv": "MLB.TV",
  "nhl-tv": "NHL.TV",
  directv: "DirecTV Stream",
  "youtube-tv": "YouTube TV",
  "team-radio": "Team Radio Apps",
  siriusxm: "SiriusXM",
}

export function serviceDisplayName(id: string): string {
  return SERVICE_DISPLAY_NAMES[id] ?? id
}

/** Canonical labels derived from ids — use for game rows, details, and upgrades. */
export const PROVIDER_LABEL = {
  ESPN_PLUS: serviceDisplayName("espn-plus"),
  MAX: serviceDisplayName("max"),
  FANDUEL_RSN: serviceDisplayName("fanduel-sports"),
  MLB_TV: serviceDisplayName("mlb-tv"),
  NHL_TV: serviceDisplayName("nhl-tv"),
  DIRECTV: serviceDisplayName("directv"),
  YOUTUBE_TV: serviceDisplayName("youtube-tv"),
  TEAM_RADIO: serviceDisplayName("team-radio"),
  SIRIUSXM: serviceDisplayName("siriusxm"),
} as const

/** Flagship radio feeds (not subscription ids) — single source for copy. */
export const LISTEN_FEED = {
  BLUES_AM: "101 ESPN Radio",
  CARDINALS_AM: "KMOX 1120 AM",
} as const

/**
 * Normalize free-text provider labels (legacy copy, API-style names) to canonical branding.
 * Prefer passing known service ids when possible — they pass through unchanged.
 */
export function providerDisplayLabel(text: string): string {
  const raw = text.trim()
  if (raw in SERVICE_DISPLAY_NAMES) return serviceDisplayName(raw)

  const l = raw.toLowerCase().replace(/\s+/g, " ")

  if (
    l.includes("bally sports") ||
    l.includes("fanduel sports network") ||
    (l.includes("fanduel") && l.includes("midwest"))
  ) {
    return PROVIDER_LABEL.FANDUEL_RSN
  }

  if (l.includes("nhl.tv") || l === "nhl tv") return PROVIDER_LABEL.NHL_TV
  if (l.includes("mlb.tv") || l === "mlb tv") return PROVIDER_LABEL.MLB_TV
  if (l === "espn+" || l.includes("espn+")) return PROVIDER_LABEL.ESPN_PLUS

  if (
    l === "max" ||
    (l.includes("max") && (l.includes("tnt") || l.includes("b/r") || l.includes("br live")))
  ) {
    return PROVIDER_LABEL.MAX
  }

  if (l.includes("directv stream") || l === "directv") return PROVIDER_LABEL.DIRECTV
  if (l.includes("youtube tv")) return PROVIDER_LABEL.YOUTUBE_TV
  if (l.includes("sirius")) return PROVIDER_LABEL.SIRIUSXM
  if (l.includes("team radio") || l.includes("radio apps")) return PROVIDER_LABEL.TEAM_RADIO

  return raw
}

/** Human-readable list for plan summaries and chips */
export function formatServiceIdList(ids: string[]): string {
  return ids.map(serviceDisplayName).join(", ")
}

/** Demo monthly price (USD) for comparing upgrade paths; unlock logic still uses ids only. */
export const SERVICE_DEMO_MONTHLY_USD: Record<string, number> = {
  "espn-plus": 10.99,
  max: 9.99,
  "fanduel-sports": 19.99,
  "mlb-tv": 12.49,
  directv: 64.99,
  "youtube-tv": 72.99,
}

export function demoMonthlyPriceUsd(serviceId: string): number | undefined {
  const p = SERVICE_DEMO_MONTHLY_USD[serviceId]
  return p !== undefined ? p : undefined
}
