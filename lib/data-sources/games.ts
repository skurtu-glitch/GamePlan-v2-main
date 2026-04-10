/**
 * Game schedule engine: canonical ingest → normalization → rights mapping → `Game` rows.
 * Falls back to inline static demo if ingest fails (resolver contract unchanged).
 *
 * Always import `@/lib/data` (or call `bindDemoSchedule`) before using getters so the
 * catalog is registered.
 */

import type { Game, Team } from "@/lib/types"
import { composeEngineGamesFromNormalized } from "@/lib/data-normalization/compose-engine-games"
import { normalizeScheduleIngest } from "@/lib/data-normalization/normalize-schedule"
import type { ScheduleValidationError } from "@/lib/data-validation/validate-schedule-ingest"
import { validateScheduleIngest } from "@/lib/data-validation/validate-schedule-ingest"
import { LISTEN_FEED, PROVIDER_LABEL } from "@/lib/streaming-service-ids"
import defaultIngest from "@/lib/data-sources/schedule/ingest-default.json"
import type { ScheduleIngestPayload } from "@/lib/data-sources/schedule/types"
import { getActiveEngineGames } from "@/lib/schedule-client-bridge"
import type { NormalizedGame, NormalizedLeague, NormalizedTeamSide } from "./types"

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
  const checkedAt = new Date().toISOString()
  try {
    const v = validateScheduleIngest(defaultIngest as unknown, { allowedTeamIds: teamIds })
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

function leagueFromSport(sport: Team["sport"]): NormalizedLeague {
  if (sport === "NHL" || sport === "MLB") return sport
  return "NHL"
}

export function toNormalizedGame(game: Game): NormalizedGame {
  return {
    id: game.id,
    league: leagueFromSport(game.homeTeam.sport),
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

  return [
    {
      id: "game-1",
      homeTeam: teams.find((t) => t.id === "stl-blues")!,
      awayTeam: teams.find((t) => t.id === "col-avalanche")!,
      dateTime: todayAt(19, 0),
      watch: {
        status: "available",
        provider: PROVIDER_LABEL.ESPN_PLUS,
        providers: ["espn-plus"],
      },
      listen: {
        status: "available",
        provider: LISTEN_FEED.BLUES_AM,
      },
      recommendation: "Watch",
      venue: "Enterprise Center",
      access: {
        status: "watchable",
        reason: `Available on ${PROVIDER_LABEL.ESPN_PLUS} with your subscription`,
        actions: [
          {
            label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`,
            type: "open",
            provider: PROVIDER_LABEL.ESPN_PLUS,
          },
          {
            label: `Listen on ${LISTEN_FEED.BLUES_AM}`,
            type: "open",
            provider: LISTEN_FEED.BLUES_AM,
          },
        ],
        bestOption: {
          label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`,
          action: {
            label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`,
            type: "open",
            provider: PROVIDER_LABEL.ESPN_PLUS,
          },
        },
      },
    },
    {
      id: "game-2",
      homeTeam: teams.find((t) => t.id === "stl-cardinals")!,
      awayTeam: teams.find((t) => t.id === "chi-cubs")!,
      dateTime: todayAt(19, 15),
      watch: {
        status: "unavailable",
        provider: PROVIDER_LABEL.FANDUEL_RSN,
        providers: ["fanduel-sports"],
        note: "Not available with your current plan",
      },
      listen: {
        status: "available",
        provider: LISTEN_FEED.CARDINALS_AM,
      },
      recommendation: "Just Listen",
      venue: "Busch Stadium",
      access: {
        status: "unavailable",
        reason: `Your plan doesn't include ${PROVIDER_LABEL.FANDUEL_RSN}`,
        actions: [
          {
            label: `Add ${PROVIDER_LABEL.FANDUEL_RSN}`,
            type: "add",
            provider: PROVIDER_LABEL.FANDUEL_RSN,
            price: "$19.99/mo",
          },
          {
            label: `Listen free on ${LISTEN_FEED.CARDINALS_AM}`,
            type: "open",
            provider: LISTEN_FEED.CARDINALS_AM,
          },
        ],
        bestOption: {
          label: "Add RSN to watch",
          action: {
            label: `Add ${PROVIDER_LABEL.FANDUEL_RSN}`,
            type: "add",
            provider: PROVIDER_LABEL.FANDUEL_RSN,
            price: "$19.99/mo",
          },
        },
      },
    },
    {
      id: "game-3",
      homeTeam: teams.find((t) => t.id === "col-avalanche")!,
      awayTeam: teams.find((t) => t.id === "stl-blues")!,
      dateTime: tomorrowAt(20, 0),
      watch: {
        status: "available",
        provider: PROVIDER_LABEL.MAX,
        providers: ["max"],
      },
      listen: {
        status: "available",
        provider: LISTEN_FEED.BLUES_AM,
      },
      recommendation: "Watch",
      venue: "Ball Arena",
    },
    {
      id: "game-4",
      homeTeam: teams.find((t) => t.id === "chi-cubs")!,
      awayTeam: teams.find((t) => t.id === "stl-cardinals")!,
      dateTime: daysFromNow(3, 13, 20),
      watch: {
        status: "partial",
        provider: PROVIDER_LABEL.MLB_TV,
        providers: ["mlb-tv"],
        note: "Out-of-market only",
      },
      listen: {
        status: "available",
        provider: LISTEN_FEED.CARDINALS_AM,
      },
      recommendation: "Just Listen",
      venue: "Wrigley Field",
    },
    {
      id: "game-5",
      homeTeam: teams.find((t) => t.id === "stl-blues")!,
      awayTeam: teams.find((t) => t.id === "col-avalanche")!,
      dateTime: daysFromNow(5, 19, 0),
      watch: {
        status: "available",
        provider: PROVIDER_LABEL.FANDUEL_RSN,
        providers: ["fanduel-sports"],
      },
      listen: {
        status: "available",
        provider: LISTEN_FEED.BLUES_AM,
      },
      recommendation: "Watch",
      venue: "Enterprise Center",
    },
  ]
}
