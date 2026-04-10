/**
 * Structural + catalog validation for schedule ingest payloads before normalization / engine bind.
 */

import type {
  BroadcastProfileId,
  ScheduleIngestEvent,
  ScheduleIngestPayload,
} from "@/lib/data-sources/schedule/types"
import { SCHEDULE_BROADCAST_PROFILE_IDS } from "@/lib/data-sources/schedule/types"

const PROFILE_SET = new Set<string>(SCHEDULE_BROADCAST_PROFILE_IDS)
const LEAGUES = new Set<string>(["NHL", "MLB"])

export interface ScheduleValidationError {
  code: string
  message: string
  path: string
}

export type ScheduleValidationResult =
  | { ok: true; payload: ScheduleIngestPayload }
  | { ok: false; errors: ScheduleValidationError[] }

export interface ValidateScheduleIngestOptions {
  allowedTeamIds: readonly string[]
}

function push(
  errors: ScheduleValidationError[],
  path: string,
  code: string,
  message: string
): void {
  errors.push({ path, code, message })
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

function isFiniteInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Math.floor(n) === n
}

/** Parse ISO-ish timestamps used in `_meta.lastUpdated` (reject unparseable). */
function isParseableInstant(iso: string): boolean {
  const t = Date.parse(iso)
  return !Number.isNaN(t)
}

/**
 * Validate raw JSON for schedule ingest. Does not mutate input.
 * When `ok`, `payload` is safe for {@link normalizeScheduleIngest}.
 */
export function validateScheduleIngest(
  raw: unknown,
  options: ValidateScheduleIngestOptions
): ScheduleValidationResult {
  const errors: ScheduleValidationError[] = []
  const allowed = new Set(options.allowedTeamIds)

  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      errors: [{ path: "", code: "root_type", message: "Expected object root" }],
    }
  }

  const o = raw as Record<string, unknown>
  const meta = o._meta
  const eventsRaw = o.events

  if (!meta || typeof meta !== "object") {
    push(errors, "_meta", "meta_required", "Missing _meta object")
  } else {
    const m = meta as Record<string, unknown>
    const lastUpdated = m.lastUpdated
    const sourceName = m.sourceName
    if (!isNonEmptyString(lastUpdated)) {
      push(errors, "_meta.lastUpdated", "meta_lastUpdated", "lastUpdated must be a non-empty string")
    } else if (!isParseableInstant(lastUpdated.trim())) {
      push(
        errors,
        "_meta.lastUpdated",
        "meta_lastUpdated_parse",
        "lastUpdated must be a parseable date/time string"
      )
    }
    if (!isNonEmptyString(sourceName)) {
      push(errors, "_meta.sourceName", "meta_sourceName", "sourceName must be a non-empty string")
    }
    if (
      m.ttlMsSuggested !== undefined &&
      (typeof m.ttlMsSuggested !== "number" || !Number.isFinite(m.ttlMsSuggested))
    ) {
      push(errors, "_meta.ttlMsSuggested", "meta_ttl", "ttlMsSuggested must be a finite number when set")
    }
  }

  if (!Array.isArray(eventsRaw)) {
    push(errors, "events", "events_array", "events must be an array")
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const m = meta as Record<string, unknown>
  const lastUpdated = String(m.lastUpdated).trim()
  const sourceName = String(m.sourceName).trim()
  const ttlMsSuggested =
    typeof m.ttlMsSuggested === "number" && Number.isFinite(m.ttlMsSuggested)
      ? m.ttlMsSuggested
      : undefined

  const events: ScheduleIngestEvent[] = []
  const stableIds: string[] = []

  for (let i = 0; i < (eventsRaw as unknown[]).length; i++) {
    const base = `events[${i}]`
    const ev = (eventsRaw as unknown[])[i]
    if (!ev || typeof ev !== "object") {
      push(errors, base, "event_shape", "Each event must be an object")
      continue
    }
    const e = ev as Record<string, unknown>

    const league = e.league
    if (typeof league !== "string" || !LEAGUES.has(league)) {
      push(errors, `${base}.league`, "league", "league must be NHL or MLB")
    }

    const homeTeamId = e.homeTeamId
    const awayTeamId = e.awayTeamId
    if (!isNonEmptyString(homeTeamId)) {
      push(errors, `${base}.homeTeamId`, "homeTeamId", "homeTeamId must be a non-empty string")
    } else if (!allowed.has(homeTeamId.trim())) {
      push(errors, `${base}.homeTeamId`, "homeTeamId_catalog", `Unknown homeTeamId: ${homeTeamId}`)
    }
    if (!isNonEmptyString(awayTeamId)) {
      push(errors, `${base}.awayTeamId`, "awayTeamId", "awayTeamId must be a non-empty string")
    } else if (!allowed.has(awayTeamId.trim())) {
      push(errors, `${base}.awayTeamId`, "awayTeamId_catalog", `Unknown awayTeamId: ${awayTeamId}`)
    }
    if (
      isNonEmptyString(homeTeamId) &&
      isNonEmptyString(awayTeamId) &&
      homeTeamId.trim() === awayTeamId.trim()
    ) {
      push(errors, `${base}.teams`, "teams_distinct", "homeTeamId and awayTeamId must differ")
    }

    const dayOffset = e.dayOffset
    if (!isFiniteInt(dayOffset)) {
      push(errors, `${base}.dayOffset`, "dayOffset", "dayOffset must be a finite integer")
    } else if (dayOffset < -30 || dayOffset > 366) {
      push(
        errors,
        `${base}.dayOffset`,
        "dayOffset_range",
        "dayOffset must be between -30 and 366"
      )
    }

    const hour = e.hour
    if (!isFiniteInt(hour) || hour < 0 || hour > 23) {
      push(errors, `${base}.hour`, "hour", "hour must be an integer 0–23")
    }

    const minute = e.minute
    if (minute !== undefined) {
      if (!isFiniteInt(minute) || minute < 0 || minute > 59) {
        push(errors, `${base}.minute`, "minute", "minute must be an integer 0–59 when set")
      }
    }

    const profile = e.broadcastProfile
    if (typeof profile !== "string" || !PROFILE_SET.has(profile)) {
      push(
        errors,
        `${base}.broadcastProfile`,
        "broadcastProfile",
        `Unknown or unsupported broadcastProfile: ${String(profile)}`
      )
    }

    if (e.venue !== undefined && e.venue !== null && typeof e.venue !== "string") {
      push(errors, `${base}.venue`, "venue", "venue must be a string when set")
    }

    if (e.externalKey !== undefined && e.externalKey !== null && typeof e.externalKey !== "string") {
      push(errors, `${base}.externalKey`, "externalKey", "externalKey must be a string when set")
    }

    const stableGameId = e.stableGameId
    if (stableGameId !== undefined && stableGameId !== null) {
      if (typeof stableGameId !== "string" || !stableGameId.trim()) {
        push(
          errors,
          `${base}.stableGameId`,
          "stableGameId",
          "stableGameId must be a non-empty string when set"
        )
      } else {
        stableIds.push(stableGameId.trim())
      }
    }

    if (errors.some((err) => err.path.startsWith(base))) continue

    const row: ScheduleIngestEvent = {
      league: league as ScheduleIngestEvent["league"],
      homeTeamId: String(homeTeamId).trim(),
      awayTeamId: String(awayTeamId).trim(),
      dayOffset: dayOffset as number,
      hour: hour as number,
      broadcastProfile: profile as BroadcastProfileId,
    }
    if (typeof minute === "number") row.minute = minute
    if (typeof e.venue === "string" && e.venue.trim()) row.venue = e.venue.trim()
    if (typeof e.externalKey === "string" && e.externalKey.trim()) row.externalKey = e.externalKey.trim()
    if (typeof stableGameId === "string" && stableGameId.trim()) {
      row.stableGameId = stableGameId.trim()
    }
    events.push(row)
  }

  const stableSet = new Set(stableIds)
  if (stableIds.length > 0 && stableSet.size !== stableIds.length) {
    push(errors, "events", "stableGameId_unique", "stableGameId values must be unique when provided")
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const payload: ScheduleIngestPayload = {
    _meta: {
      lastUpdated,
      sourceName,
      ...(ttlMsSuggested !== undefined ? { ttlMsSuggested } : {}),
    },
    events,
  }

  return { ok: true, payload }
}
