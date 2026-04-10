/**
 * Game schedule engine: canonical ingest → normalization → rights mapping → `Game` rows.
 * Falls back to inline static demo if ingest fails (resolver contract unchanged).
 *
 * Always import `@/lib/data` (or call `bindDemoSchedule`) before using getters so the
 * catalog is registered.
 */

import type { Game, Team } from "@/lib/types"
import {
  composeEngineGamesFromNormalized,
  optionalAccessForProfile,
} from "@/lib/data-normalization/compose-engine-games"
import { normalizeScheduleIngest } from "@/lib/data-normalization/normalize-schedule"
import type { ScheduleValidationError } from "@/lib/data-validation/validate-schedule-ingest"
import { validateScheduleIngest } from "@/lib/data-validation/validate-schedule-ingest"
import defaultIngest from "@/lib/data-sources/schedule/ingest-default.json"
import { listenLabelForGame, watchMappingForProfile } from "@/lib/data-sources/rights/provider-map"
import type { BroadcastProfileId, ScheduleIngestPayload } from "@/lib/data-sources/schedule/types"
import { getActiveEngineGames } from "@/lib/schedule-client-bridge"
import type { NormalizedGame, NormalizedTeamSide } from "./types"

export interface GamesDataSource {
  getEngineGames(): Game[]
  getNormalizedSchedule(): NormalizedGame[]
  getUpcomingGames(now?: Date): NormalizedGame[]
  getGamesForTeams(teamIds: readonly string[]): NormalizedGame[]
  getGamesInWindow(days: number, now?: Date): NormalizedGame[]
}

let schedule: Game[] | null = null

/** Freshness for the currently bound schedule (sync path uses committed ingest). */
let scheduleFreshness: DataFreshness = {
  lastUpdated: new Date(0).toISOString(),
  sourceName: "uninitialized",
  isStale: true,
  sourceUsed: "uninitialized",
  fallbackUsed: false,
}

export type ScheduleSourceUsed =
  | "remote"
  | "last-known-good"
  | "committed-ingest"
  | "static-demo-fallback"
  | "uninitialized"

export interface ScheduleValidationSummary {
  status: "ok" | "error"
  checkedAt: string
  errors?: ScheduleValidationError[]
}

let lastScheduleValidation: ScheduleValidationSummary = {
  status: "ok",
  checkedAt: new Date(0).toISOString(),
}

export interface DataFreshness {
  lastUpdated: string
  sourceName: string
  isStale: boolean
  /** How the active in-memory engine schedule was last bound. */
  sourceUsed: ScheduleSourceUsed
  /** True when a higher-priority source failed and a lower tier supplied the active schedule. */
  fallbackUsed: boolean
  /** When {@link sourceUsed} is `last-known-good`, timestamp of the persisted snapshot file (ISO). */
  lastKnownGoodSavedAt?: string
  gameCount?: number
  /** Last ingest validation attempt (remote refresh, LKG load, or committed bind). */
  validation?: ScheduleValidationSummary
}

function defaultStaleTtlMs(payloadTtl?: number): number {
  const env = Number(process.env.GAMEPLAN_SCHEDULE_STALE_AFTER_MS ?? NaN)
  if (Number.isFinite(env) && env > 0) return env
  if (payloadTtl !== undefined && Number.isFinite(payloadTtl) && payloadTtl > 0) {
    return payloadTtl
  }
  return 24 * 60 * 60 * 1000
}

function computeStale(lastUpdatedIso: string, ttlMs: number): boolean {
  const t = Date.parse(lastUpdatedIso)
  if (Number.isNaN(t)) return true
  return Date.now() - t > ttlMs
}

/** Last validation summary (persists across failed binds). */
export function getLastScheduleValidation(): ScheduleValidationSummary {
  return lastScheduleValidation
}

/** Metadata for the active engine schedule (debug / ops / optional UI). */
export function getDataFreshness(): DataFreshness {
  if (!schedule) {
    return {
      lastUpdated: new Date(0).toISOString(),
      sourceName: "uninitialized",
      isStale: true,
      sourceUsed: "uninitialized",
      fallbackUsed: false,
      validation: lastScheduleValidation,
    }
  }
  return {
    ...scheduleFreshness,
    gameCount: schedule.length,
    validation: scheduleFreshness.validation ?? lastScheduleValidation,
  }
}

export function buildFreshnessForPayload(
  payload: ScheduleIngestPayload,
  sourceUsed: ScheduleSourceUsed,
  fallbackUsed: boolean,
  lastKnownGoodSavedAt?: string
): DataFreshness {
  const ttl = defaultStaleTtlMs(payload._meta.ttlMsSuggested)
  return {
    lastUpdated: payload._meta.lastUpdated,
    sourceName: payload._meta.sourceName,
    isStale: computeStale(payload._meta.lastUpdated, ttl),
    sourceUsed,
    fallbackUsed,
    ...(lastKnownGoodSavedAt ? { lastKnownGoodSavedAt } : {}),
  }
}

/**
 * Replace in-memory engine games + freshness (server pipeline / ops refresh).
 * Does not change the `Game` row shape consumed by `resolveGameAccess`.
 */
export function applyEngineScheduleFromPipeline(
  games: Game[],
  freshness: DataFreshness,
  validation: ScheduleValidationSummary
): void {
  schedule = games
  lastScheduleValidation = validation
  scheduleFreshness = {
    ...freshness,
    gameCount: games.length,
    validation,
  }
}

function assertSchedule(): Game[] {
  if (!schedule) {
    throw new Error(
      "Game schedule not initialized. Import `@/lib/data` (or call `bindDemoSchedule`) before reading games."
    )
  }
  return schedule
}

/**
 * Load schedule from the canonical ingest pipeline, then bind engine games.
 * Called from `lib/data.ts` after `teams` is defined.
 */
export function bindDemoSchedule(teams: Team[], referenceOverride?: Date): void {
  const anchor = referenceOverride ?? new Date()
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const teamIds = teams.map((t) => t.id)
  const teamLeagueById = new Map(teams.map((t) => [t.id, t.league]))
  const checkedAt = new Date().toISOString()
  try {
    const v = validateScheduleIngest(defaultIngest as unknown, {
      allowedTeamIds: teamIds,
      teamLeagueById,
    })
    if (!v.ok) {
      lastScheduleValidation = {
        status: "error",
        checkedAt,
        errors: v.errors,
      }
      throw new Error(
        `[GamePlan] Committed ingest validation failed: ${v.errors.map((e) => e.message).join("; ")}`
      )
    }
    const normalized = normalizeScheduleIngest(v.payload, anchor, teamById)
    const games = composeEngineGamesFromNormalized(normalized, teamById)
    const okValidation: ScheduleValidationSummary = { status: "ok", checkedAt }
    applyEngineScheduleFromPipeline(
      games,
      buildFreshnessForPayload(v.payload, "committed-ingest", false),
      okValidation
    )
  } catch (e) {
    console.warn("[GamePlan] Schedule pipeline failed; using static demo games.", e)
    const fallbackValidation: ScheduleValidationSummary = {
      status: "error",
      checkedAt: new Date().toISOString(),
      errors: [
        {
          code: "bind_fallback",
          path: "",
          message: e instanceof Error ? e.message : String(e),
        },
      ],
    }
    applyEngineScheduleFromPipeline(
      buildStaticDemoEngineGames(teams, anchor),
      {
        lastUpdated: new Date().toISOString(),
        sourceName: "static-demo-fallback",
        isStale: false,
        sourceUsed: "static-demo-fallback",
        fallbackUsed: true,
      },
      fallbackValidation
    )
  }
}

/** Full `Game` rows used by `resolveGameAccess`, plan samples, and UI. */
export function getEngineGames(): Game[] {
  return getActiveEngineGames(assertSchedule)
}

export function toNormalizedTeamSide(team: Team): NormalizedTeamSide {
  return {
    id: team.id,
    name: `${team.city} ${team.name}`,
    abbreviation: team.abbreviation,
    primaryColor: team.primaryColor,
  }
}

export function toNormalizedGame(game: Game): NormalizedGame {
  return {
    id: game.id,
    league: game.homeTeam.league,
    homeTeam: toNormalizedTeamSide(game.homeTeam),
    awayTeam: toNormalizedTeamSide(game.awayTeam),
    startTime: game.dateTime,
    venue: game.venue,
  }
}

export function getNormalizedSchedule(): NormalizedGame[] {
  return getEngineGames().map(toNormalizedGame)
}

/** Games with start &gt;= `now`, soonest first. */
export function getUpcomingGames(now: Date = new Date()): NormalizedGame[] {
  const t = now.getTime()
  return getEngineGames()
    .filter((g) => new Date(g.dateTime).getTime() >= t)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .map(toNormalizedGame)
}

export function getGamesForTeams(teamIds: readonly string[]): NormalizedGame[] {
  const set = new Set(teamIds)
  return getEngineGames()
    .filter((g) => set.has(g.homeTeam.id) || set.has(g.awayTeam.id))
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .map(toNormalizedGame)
}

/**
 * Local-calendar window: start of `now`'s day through start of day after `days` days (exclusive upper bound),
 * same convention as rolling-week helpers in the Assistant.
 */
export function getGamesInWindow(days: number, now: Date = new Date()): NormalizedGame[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  const t0 = start.getTime()
  const t1 = end.getTime()
  return getEngineGames()
    .filter((g) => {
      const t = new Date(g.dateTime).getTime()
      return t >= t0 && t < t1
    })
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .map(toNormalizedGame)
}

export function getDefaultGamesDataSource(): GamesDataSource {
  return {
    getEngineGames,
    getNormalizedSchedule,
    getUpcomingGames,
    getGamesForTeams,
    getGamesInWindow,
  }
}

function recommendationForStaticWatch(status: Game["watch"]["status"]): Game["recommendation"] {
  if (status === "available") return "Watch"
  if (status === "partial") return "Just Listen"
  return "Just Listen"
}

function staticDemoGame(
  teams: Team[],
  spec: {
    id: string
    homeId: string
    awayId: string
    dateTime: string
    venue: string
    profile: BroadcastProfileId
  }
): Game {
  const home = teams.find((t) => t.id === spec.homeId)
  const away = teams.find((t) => t.id === spec.awayId)
  if (!home || !away) {
    throw new Error(`buildStaticDemoEngineGames: missing team for ${spec.id}`)
  }
  const wm = watchMappingForProfile(spec.profile)
  const listenLabel = listenLabelForGame(spec.homeId, spec.awayId)
  const watch: Game["watch"] = {
    status: wm.status,
    provider: wm.provider,
    providers: [...wm.providers],
    ...(wm.note ? { note: wm.note } : {}),
  }
  const game: Game = {
    id: spec.id,
    homeTeam: home,
    awayTeam: away,
    dateTime: spec.dateTime,
    watch,
    listen: { status: "available", provider: listenLabel },
    recommendation: recommendationForStaticWatch(watch.status),
    venue: spec.venue,
  }
  const access = optionalAccessForProfile(spec.profile, listenLabel)
  if (access) game.access = access
  return game
}

/** Mirrors `ingest-default.json` for pipeline fallback parity (stable ids game-1 …). */
export function buildStaticDemoEngineGames(teams: Team[], today: Date): Game[] {
  const todayAt = (hour: number, min = 0) => {
    const d = new Date(today)
    d.setHours(hour, min, 0, 0)
    return d.toISOString()
  }
  const tomorrowAt = (hour: number, min = 0) => {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    d.setHours(hour, min, 0, 0)
    return d.toISOString()
  }
  const daysFromNow = (days: number, hour: number, min = 0) => {
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    d.setHours(hour, min, 0, 0)
    return d.toISOString()
  }

  const specs: Array<{
    id: string
    homeId: string
    awayId: string
    dateTime: string
    venue: string
    profile: BroadcastProfileId
  }> = [
    {
      id: "game-1",
      homeId: "stl-blues",
      awayId: "col-avalanche",
      dateTime: todayAt(19, 0),
      venue: "Enterprise Center",
      profile: "nhl-national-espn-plus",
    },
    {
      id: "game-2",
      homeId: "stl-cardinals",
      awayId: "chi-cubs",
      dateTime: todayAt(19, 15),
      venue: "Busch Stadium",
      profile: "mlb-rsn-fanduel-unavailable",
    },
    {
      id: "game-3",
      homeId: "col-avalanche",
      awayId: "stl-blues",
      dateTime: tomorrowAt(20, 0),
      venue: "Ball Arena",
      profile: "nhl-national-max",
    },
    {
      id: "game-4",
      homeId: "chi-cubs",
      awayId: "stl-cardinals",
      dateTime: daysFromNow(3, 13, 20),
      venue: "Wrigley Field",
      profile: "mlb-oom-mlb-tv",
    },
    {
      id: "game-5",
      homeId: "stl-blues",
      awayId: "col-avalanche",
      dateTime: daysFromNow(5, 19, 0),
      venue: "Enterprise Center",
      profile: "nhl-rsn-fanduel-available",
    },
    {
      id: "game-6",
      homeId: "ny-rangers",
      awayId: "chi-blackhawks",
      dateTime: daysFromNow(2, 19, 0),
      venue: "Madison Square Garden",
      profile: "nhl-national-espn-plus",
    },
    {
      id: "game-7",
      homeId: "dal-stars",
      awayId: "stl-blues",
      dateTime: daysFromNow(4, 20, 0),
      venue: "American Airlines Center",
      profile: "nhl-national-max",
    },
    {
      id: "game-8",
      homeId: "pit-pirates",
      awayId: "cin-reds",
      dateTime: daysFromNow(4, 18, 40),
      venue: "PNC Park",
      profile: "mlb-rsn-fanduel-unavailable",
    },
    {
      id: "game-9",
      homeId: "mil-brewers",
      awayId: "stl-cardinals",
      dateTime: daysFromNow(6, 19, 10),
      venue: "American Family Field",
      profile: "mlb-oom-mlb-tv",
    },
    {
      id: "game-10",
      homeId: "chi-blackhawks",
      awayId: "col-avalanche",
      dateTime: daysFromNow(7, 20, 0),
      venue: "United Center",
      profile: "nhl-rsn-fanduel-available",
    },
    {
      id: "game-11",
      homeId: "stl-blues",
      awayId: "chi-blackhawks",
      dateTime: daysFromNow(8, 19, 0),
      venue: "Enterprise Center",
      profile: "nhl-rsn-fanduel-available",
    },
    {
      id: "game-12",
      homeId: "stl-cardinals",
      awayId: "cin-reds",
      dateTime: daysFromNow(8, 18, 35),
      venue: "Busch Stadium",
      profile: "mlb-rsn-fanduel-unavailable",
    },
    {
      id: "game-13",
      homeId: "ny-rangers",
      awayId: "stl-blues",
      dateTime: daysFromNow(9, 19, 30),
      venue: "Madison Square Garden",
      profile: "nhl-national-max",
    },
    {
      id: "game-14",
      homeId: "stl-cardinals",
      awayId: "pit-pirates",
      dateTime: daysFromNow(9, 19, 5),
      venue: "Busch Stadium",
      profile: "mlb-national-espn-plus",
    },
    {
      id: "game-15",
      homeId: "chi-blackhawks",
      awayId: "stl-blues",
      dateTime: daysFromNow(10, 20, 30),
      venue: "United Center",
      profile: "nhl-national-espn-plus",
    },
    {
      id: "game-16",
      homeId: "cin-reds",
      awayId: "stl-cardinals",
      dateTime: daysFromNow(10, 18, 40),
      venue: "Great American Ball Park",
      profile: "mlb-oom-mlb-tv",
    },
    {
      id: "game-17",
      homeId: "stl-blues",
      awayId: "dal-stars",
      dateTime: daysFromNow(11, 20, 0),
      venue: "Enterprise Center",
      profile: "nhl-oom-nhl-tv",
    },
    {
      id: "game-18",
      homeId: "stl-cardinals",
      awayId: "mil-brewers",
      dateTime: daysFromNow(11, 19, 15),
      venue: "Busch Stadium",
      profile: "mlb-rsn-fanduel-unavailable",
    },
    {
      id: "game-19",
      homeId: "col-avalanche",
      awayId: "stl-blues",
      dateTime: daysFromNow(12, 21, 0),
      venue: "Ball Arena",
      profile: "nhl-national-max",
    },
    {
      id: "game-20",
      homeId: "stl-cardinals",
      awayId: "chi-cubs",
      dateTime: daysFromNow(12, 18, 15),
      venue: "Busch Stadium",
      profile: "mlb-rsn-fanduel-unavailable",
    },
    {
      id: "game-21",
      homeId: "pit-pirates",
      awayId: "stl-cardinals",
      dateTime: daysFromNow(13, 18, 5),
      venue: "PNC Park",
      profile: "mlb-oom-mlb-tv",
    },
    {
      id: "game-22",
      homeId: "stl-blues",
      awayId: "ny-rangers",
      dateTime: daysFromNow(13, 19, 0),
      venue: "Enterprise Center",
      profile: "nhl-rsn-fanduel-available",
    },
    {
      id: "game-23",
      homeId: "stl-cardinals",
      awayId: "cin-reds",
      dateTime: daysFromNow(14, 12, 10),
      venue: "Busch Stadium",
      profile: "mlb-national-espn-plus",
    },
    {
      id: "game-24",
      homeId: "chi-cubs",
      awayId: "stl-cardinals",
      dateTime: daysFromNow(14, 13, 20),
      venue: "Wrigley Field",
      profile: "mlb-oom-mlb-tv",
    },
    {
      id: "game-25",
      homeId: "dal-stars",
      awayId: "ny-rangers",
      dateTime: daysFromNow(8, 20, 0),
      venue: "American Airlines Center",
      profile: "nhl-national-espn-plus",
    },
    {
      id: "game-26",
      homeId: "pit-pirates",
      awayId: "mil-brewers",
      dateTime: daysFromNow(12, 19, 10),
      venue: "PNC Park",
      profile: "mlb-rsn-fanduel-unavailable",
    },
    {
      id: "game-27",
      homeId: "chi-blackhawks",
      awayId: "dal-stars",
      dateTime: daysFromNow(11, 19, 30),
      venue: "United Center",
      profile: "nhl-rsn-fanduel-available",
    },
    {
      id: "game-28",
      homeId: "cin-reds",
      awayId: "chi-cubs",
      dateTime: daysFromNow(10, 13, 10),
      venue: "Great American Ball Park",
      profile: "mlb-national-espn-plus",
    },
  ]

  return specs.map((s) => staticDemoGame(teams, s))
}
