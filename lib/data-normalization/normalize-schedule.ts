/**
 * Normalize raw schedule ingest into pipeline rows (stable ids, ISO times, league).
 */

import type { Team } from "@/lib/types"
import type {
  ScheduleIngestEvent,
  ScheduleIngestPayload,
} from "@/lib/data-sources/schedule/types"

export interface NormalizedPipelineGame {
  id: string
  league: "NHL" | "MLB"
  homeTeamId: string
  awayTeamId: string
  dateTime: string
  venue?: string
  broadcastProfile: ScheduleIngestEvent["broadcastProfile"]
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Local calendar date — matches demo schedule (`setHours` on local `Date`). */
function formatIdDateLocal(d: Date): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

/**
 * Deterministic id: stable across refreshes for the same matchup, league, and local game date.
 */
export function makeDeterministicGameId(
  league: string,
  gameLocalDate: Date,
  homeTeamId: string,
  awayTeamId: string,
  dedupeSuffix?: string
): string {
  const datePart = formatIdDateLocal(gameLocalDate)
  const base = `gp-${league.toLowerCase()}-${datePart}-${homeTeamId}-vs-${awayTeamId}`
  return dedupeSuffix ? `${base}-${dedupeSuffix}` : base
}

/** Same convention as legacy `buildStaticDemoEngineGames` (local day + local wall time). */
function eventStartLocal(event: ScheduleIngestEvent, anchor: Date): Date {
  const d = new Date(anchor)
  d.setDate(d.getDate() + event.dayOffset)
  d.setHours(event.hour, event.minute ?? 0, 0, 0)
  return d
}

function assertTeamsExist(
  event: ScheduleIngestEvent,
  teamById: ReadonlyMap<string, Team>
): void {
  if (!teamById.has(event.homeTeamId)) {
    throw new Error(`Unknown homeTeamId: ${event.homeTeamId}`)
  }
  if (!teamById.has(event.awayTeamId)) {
    throw new Error(`Unknown awayTeamId: ${event.awayTeamId}`)
  }
}

/**
 * @param teamById — catalog teams (same ids as `lib/data` `teams`).
 */
export function normalizeScheduleIngest(
  payload: ScheduleIngestPayload,
  anchorDate: Date,
  teamById: ReadonlyMap<string, Team>
): NormalizedPipelineGame[] {
  const counts = new Map<string, number>()

  return payload.events.map((event) => {
    assertTeamsExist(event, teamById)
    const start = eventStartLocal(event, anchorDate)
    const dateKey = formatIdDateLocal(start)
    const dupKey = `${event.league}-${dateKey}-${event.homeTeamId}-${event.awayTeamId}`
    const n = (counts.get(dupKey) ?? 0) + 1
    counts.set(dupKey, n)
    const suffix = n > 1 ? String(n) : event.externalKey ?? undefined

    const id =
      typeof event.stableGameId === "string" && event.stableGameId.trim()
        ? event.stableGameId.trim()
        : makeDeterministicGameId(
            event.league,
            start,
            event.homeTeamId,
            event.awayTeamId,
            suffix
          )

    return {
      id,
      league: event.league,
      homeTeamId: event.homeTeamId,
      awayTeamId: event.awayTeamId,
      dateTime: start.toISOString(),
      venue: event.venue,
      broadcastProfile: event.broadcastProfile,
    }
  })
}

export function parseScheduleIngestPayload(raw: unknown): ScheduleIngestPayload {
  if (!raw || typeof raw !== "object") throw new Error("Schedule ingest: expected object")
  const o = raw as Record<string, unknown>
  const meta = o._meta
  const events = o.events
  if (!meta || typeof meta !== "object") throw new Error("Schedule ingest: missing _meta")
  if (!Array.isArray(events)) throw new Error("Schedule ingest: events must be an array")

  const m = meta as Record<string, unknown>
  const lastUpdated = typeof m.lastUpdated === "string" ? m.lastUpdated : ""
  const sourceName = typeof m.sourceName === "string" ? m.sourceName : "unknown"
  if (!lastUpdated) throw new Error("Schedule ingest: meta.lastUpdated required")

  return {
    _meta: {
      lastUpdated,
      sourceName,
      ttlMsSuggested:
        typeof m.ttlMsSuggested === "number" && Number.isFinite(m.ttlMsSuggested)
          ? m.ttlMsSuggested
          : undefined,
    },
    events: events as ScheduleIngestEvent[],
  }
}
