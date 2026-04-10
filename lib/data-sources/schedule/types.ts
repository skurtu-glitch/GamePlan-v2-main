/**
 * Raw schedule ingest shapes (API-like or file-based). Not used directly by the resolver.
 */

export interface ScheduleIngestMeta {
  lastUpdated: string
  sourceName: string
  /** Suggested client TTL for staleness hints (ms). */
  ttlMsSuggested?: number
}

/** Maps to managed rights profiles in `provider-map.ts`. */
export type BroadcastProfileId =
  | "nhl-national-espn-plus"
  | "mlb-national-espn-plus"
  | "mlb-rsn-fanduel-unavailable"
  | "nhl-national-max"
  | "mlb-oom-mlb-tv"
  | "nhl-oom-nhl-tv"
  | "nhl-rsn-fanduel-available"

/** All known ingest `broadcastProfile` ids (validation + mapping). */
export const SCHEDULE_BROADCAST_PROFILE_IDS: readonly BroadcastProfileId[] = [
  "nhl-national-espn-plus",
  "mlb-national-espn-plus",
  "mlb-rsn-fanduel-unavailable",
  "nhl-national-max",
  "mlb-oom-mlb-tv",
  "nhl-oom-nhl-tv",
  "nhl-rsn-fanduel-available",
] as const

export interface ScheduleIngestEvent {
  /** Stable external key for deterministic ids (optional). */
  externalKey?: string
  /**
   * When set, used as `Game.id` (preserves deep links / bookmarks).
   * Otherwise id is derived from league + local date + teams (+ dedupe suffix).
   */
  stableGameId?: string
  league: "NHL" | "MLB"
  homeTeamId: string
  awayTeamId: string
  venue?: string
  /** Local calendar day offset from anchor date (0 = same day as anchor). */
  dayOffset: number
  hour: number
  minute?: number
  broadcastProfile: BroadcastProfileId
}

export interface ScheduleIngestPayload {
  _meta: ScheduleIngestMeta
  events: ScheduleIngestEvent[]
}
