/**
 * Normalized, ingestion-friendly game shape for live/upcoming schedules.
 * Distinct from `Game` in `@/lib/types` (watch/listen/access — resolver inputs).
 */

export type NormalizedLeague = "NHL" | "MLB"

export interface NormalizedTeamSide {
  id: string
  /** Display name (e.g. city + nickname). */
  name: string
  abbreviation: string
  primaryColor?: string
}

export interface NormalizedGame {
  id: string
  league: NormalizedLeague
  homeTeam: NormalizedTeamSide
  awayTeam: NormalizedTeamSide
  /** ISO 8601 start time (UTC), same convention as `Game.dateTime`. */
  startTime: string
  venue?: string
}
