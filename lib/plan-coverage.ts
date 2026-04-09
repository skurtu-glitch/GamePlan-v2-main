/**
 * Plan Details **sample-game** coverage (deterministic slice), built the same way as Home / Game Detail:
 *
 * 1. Load `servicesIncluded` from the catalog plan (`optimizer-plans.ts`).
 * 2. Build a `DemoUserState` whose **only** entitlement change is `connectedServiceIds = servicesIncluded`
 *    (location/prefs stay at demo defaults — same resolver inputs as the rest of the app aside from services).
 * 3. For each fixed sample `Game`, run `resolveGameAccess(game, simulatedState)` and map the result.
 *
 * **No plan-tier branching** assigns watch/listen/unavailable; status always comes from the resolver.
 *
 * **Season-level** `gamesWatchable` / `gamesListenOnly` / `totalGames` on `OptimizerPlan` remain the catalog’s
 * separate season model. The sample list can disagree with those counts (different game population and mix);
 * compare `getCoverageStats(getPlanCoverage(...))` to season fields only qualitatively.
 */

import type { Game, Sport } from "./types"
import { teams } from "./data"
import {
  defaultDemoUserState,
  demoUserWithConnectedServiceIds,
  type DemoUserState,
} from "./demo-user"
import { getOptimizerPlanById } from "./optimizer-plans"
import { resolveGameAccess } from "./resolve-game-access"
import { formatServiceIdList, LISTEN_FEED } from "./streaming-service-ids"

export interface GameCoverage {
  id: string
  homeTeam: string
  awayTeam: string
  date: string
  /** ISO start time (UTC) for short-date formatting in upgrade UX */
  dateTimeIso?: string
  time: string
  sport: Sport
  status: "watchable" | "listen-only" | "unavailable"
  provider?: string
  reason?: string
  /** From `resolveGameAccess` when video is not available; optional for downstream / future UI */
  fixRecommendation?: string
}

export interface PlanCoverage {
  planId: string
  planName: string
  games: GameCoverage[]
}

const COVERAGE_GAME_COUNT = 10

/** Same slot labels as before for stable Plan Details UI. */
const DEMO_GAME_TIMES = [
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
  "6:00 PM",
  "9:00 PM",
]

/** Deterministic video entitlement mix (matches access resolver, not %-of-season synthetic). */
const NHL_WATCH_PROVIDER_ROWS: string[][] = [
  ["espn-plus"],
  ["fanduel-sports"],
  ["max"],
  ["espn-plus"],
  ["fanduel-sports"],
  ["max"],
  ["espn-plus"],
  ["fanduel-sports"],
  ["max"],
  ["espn-plus"],
]

const MLB_WATCH_PROVIDER_ROWS: string[][] = [
  ["mlb-tv"],
  ["fanduel-sports"],
  ["mlb-tv"],
  ["fanduel-sports"],
  ["mlb-tv"],
  ["fanduel-sports"],
  ["mlb-tv"],
  ["fanduel-sports"],
  ["mlb-tv"],
  ["fanduel-sports"],
]

function teamLabel(team: { city: string; name: string }): string {
  return `${team.city} ${team.name}`
}

function watchDisplayLabel(providerIds: string[]): string {
  return formatServiceIdList(providerIds)
}

function buildNhlCoverageGames(): Game[] {
  const blues = teams.find((t) => t.id === "stl-blues")!
  const avs = teams.find((t) => t.id === "col-avalanche")!
  const out: Game[] = []
  const anchorMs = Date.UTC(2026, 3, 8)

  for (let i = 0; i < COVERAGE_GAME_COUNT; i++) {
    const dayOffset = i * 3 + (i % 2)
    const sortMs = anchorMs + dayOffset * 86_400_000
    const providerIds = [...NHL_WATCH_PROVIDER_ROWS[i]]
    const isHome = i % 2 === 0
    const home = isHome ? blues : avs
    const away = isHome ? avs : blues
    out.push({
      id: `NHL-coverage-${i + 1}`,
      homeTeam: home,
      awayTeam: away,
      dateTime: new Date(sortMs).toISOString(),
      watch: {
        status: "available",
        provider: watchDisplayLabel(providerIds),
        providers: providerIds,
      },
      listen: {
        status: "available",
        provider: LISTEN_FEED.BLUES_AM,
      },
      recommendation: "Watch",
      venue: home.id === "stl-blues" ? "Enterprise Center" : "Ball Arena",
    })
  }
  return out
}

function buildMlbCoverageGames(): Game[] {
  const cards = teams.find((t) => t.id === "stl-cardinals")!
  const cubs = teams.find((t) => t.id === "chi-cubs")!
  const out: Game[] = []
  const anchorMs = Date.UTC(2026, 3, 9)

  for (let i = 0; i < COVERAGE_GAME_COUNT; i++) {
    const dayOffset = i * 3 + (i % 2)
    const sortMs = anchorMs + dayOffset * 86_400_000
    const providerIds = [...MLB_WATCH_PROVIDER_ROWS[i]]
    const isHome = i % 2 === 0
    const home = isHome ? cards : cubs
    const away = isHome ? cubs : cards
    out.push({
      id: `MLB-coverage-${i + 1}`,
      homeTeam: home,
      awayTeam: away,
      dateTime: new Date(sortMs).toISOString(),
      watch: {
        status: "available",
        provider: watchDisplayLabel(providerIds),
        providers: providerIds,
      },
      listen: {
        status: "available",
        provider: LISTEN_FEED.CARDINALS_AM,
      },
      recommendation: "Watch",
      venue: home.id === "stl-cardinals" ? "Busch Stadium" : "Wrigley Field",
    })
  }
  return out
}

const nhlCoverageGames = buildNhlCoverageGames()
const mlbCoverageGames = buildMlbCoverageGames()

const COVERAGE_SORT_KEY = new Map<string, number>(
  [...nhlCoverageGames, ...mlbCoverageGames].map((g) => [
    g.id,
    new Date(g.dateTime).getTime(),
  ])
)

/**
 * Simulated subscriber for this catalog plan: **exactly** the plan’s `servicesIncluded`
 * (Cheapest / Best Value / Full / Radio Only — e.g. radio tier is only `team-radio`).
 * Same shape as real demo user state passed to `resolveGameAccess` elsewhere.
 */
export function buildSimulatedDemoUserStateForPlan(planId: string): DemoUserState {
  const plan = getOptimizerPlanById(planId)
  const ids = plan ? [...plan.servicesIncluded] : [...defaultDemoUserState.connectedServiceIds]
  return demoUserWithConnectedServiceIds(defaultDemoUserState, ids)
}

/** Same game list Plan Details / upgrade diff use for a scope (deterministic, sorted). */
export function getSampleGamesForScope(scope: "blues" | "cardinals" | "both"): Game[] {
  const gameList: Game[] = []
  if (scope === "blues" || scope === "both") {
    gameList.push(...nhlCoverageGames)
  }
  if (scope === "cardinals" || scope === "both") {
    gameList.push(...mlbCoverageGames)
  }
  gameList.sort(
    (a, b) =>
      new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  )
  return gameList
}

export function countWatchableOnSampleSchedule(
  scope: "blues" | "cardinals" | "both",
  userState: DemoUserState
): number {
  let n = 0
  for (const game of getSampleGamesForScope(scope)) {
    if (resolveGameAccess(game, userState).status === "watchable") n++
  }
  return n
}

export interface SampleCoverageBaselineCounts {
  gamesWatchable: number
  gamesListenOnly: number
  gamesUnavailable: number
  totalGames: number
}

/** Resolver counts on the deterministic sample for an arbitrary user state (Plan Details / Home parity). */
export function getSampleCoverageCounts(
  scope: "blues" | "cardinals" | "both",
  userState: DemoUserState
): SampleCoverageBaselineCounts {
  let gamesWatchable = 0
  let gamesListenOnly = 0
  let gamesUnavailable = 0
  const games = getSampleGamesForScope(scope)
  for (const game of games) {
    const s = resolveGameAccess(game, userState).status
    if (s === "watchable") gamesWatchable++
    else if (s === "listen-only") gamesListenOnly++
    else gamesUnavailable++
  }
  return {
    gamesWatchable,
    gamesListenOnly,
    gamesUnavailable,
    totalGames: games.length,
  }
}

export interface SampleTransitionCounts {
  newlyWatchableGames: number
  newlyListenableGames: number
  lostWatchableGames: number
  lostListenableGames: number
}

/**
 * Pairwise sample comparison: current user vs candidate `connectedServiceIds`.
 * Aligns with Upgrade Impact (`listen-only`/`unavailable` → `watchable` = newly watchable).
 */
export function getSampleTransitionCounts(
  scope: "blues" | "cardinals" | "both",
  fromState: DemoUserState,
  toServiceIds: string[]
): SampleTransitionCounts {
  const toState = demoUserWithConnectedServiceIds(fromState, toServiceIds)
  let newlyWatchableGames = 0
  let newlyListenableGames = 0
  let lostWatchableGames = 0
  let lostListenableGames = 0

  for (const game of getSampleGamesForScope(scope)) {
    const b = resolveGameAccess(game, fromState).status
    const a = resolveGameAccess(game, toState).status

    if (b !== "watchable" && a === "watchable") newlyWatchableGames++
    if (b === "not-available" && a === "listen-only") newlyListenableGames++
    if (b === "watchable" && a !== "watchable") lostWatchableGames++
    if (b !== "not-available" && a === "not-available") lostListenableGames++
  }

  return {
    newlyWatchableGames,
    newlyListenableGames,
    lostWatchableGames,
    lostListenableGames,
  }
}

/** Games that become watchable on the sample schedule when switching entitlements to `candidateServiceIds`. */
export function countNewlyWatchableOnSampleSchedule(
  scope: "blues" | "cardinals" | "both",
  fromState: DemoUserState,
  candidateServiceIds: string[]
): number {
  return getSampleTransitionCounts(scope, fromState, candidateServiceIds).newlyWatchableGames
}

function formatCoverageDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function timeLabelForGame(game: Game): string {
  const m = game.id.match(/(\d+)$/)
  const n = m ? parseInt(m[1], 10) : 1
  const i = n - 1
  return DEMO_GAME_TIMES[Math.max(0, i) % DEMO_GAME_TIMES.length]
}

function toGameCoverage(game: Game, resolved: ReturnType<typeof resolveGameAccess>): GameCoverage {
  const status: GameCoverage["status"] =
    resolved.status === "watchable"
      ? "watchable"
      : resolved.status === "listen-only"
        ? "listen-only"
        : "unavailable"

  const row: GameCoverage = {
    id: game.id,
    homeTeam: teamLabel(game.homeTeam),
    awayTeam: teamLabel(game.awayTeam),
    date: formatCoverageDate(game.dateTime),
    dateTimeIso: game.dateTime,
    time: timeLabelForGame(game),
    sport: game.homeTeam.sport,
    status,
  }

  if (resolved.fixRecommendation) {
    row.fixRecommendation = resolved.fixRecommendation
  }

  if (status === "watchable") {
    row.provider = game.watch.provider ?? resolved.providers[0]
  } else if (status === "listen-only") {
    row.provider = game.listen.provider ?? resolved.providers[0]
    row.reason = resolved.reason
  } else {
    row.reason = resolved.reason
    row.provider = resolved.fixRecommendation ?? resolved.primaryAction.label
  }

  return row
}

function fallbackPlanName(planId: string): string {
  if (planId.includes("cheapest")) return "Cheapest"
  if (planId.includes("value")) return "Best Value"
  if (planId.includes("full")) return "Full Coverage"
  return "Radio Only"
}

export function getPlanCoverage(
  planId: string,
  teamFilter: "blues" | "cardinals" | "both"
): PlanCoverage {
  const catalog = getOptimizerPlanById(planId)
  const planName = catalog?.name ?? fallbackPlanName(planId)
  const userState = buildSimulatedDemoUserStateForPlan(planId)

  const gameList = getSampleGamesForScope(teamFilter)

  const games: GameCoverage[] = gameList.map((game) =>
    toGameCoverage(game, resolveGameAccess(game, userState))
  )

  games.sort(
    (a, b) => (COVERAGE_SORT_KEY.get(a.id) ?? 0) - (COVERAGE_SORT_KEY.get(b.id) ?? 0)
  )

  return {
    planId,
    planName,
    games,
  }
}

export function getCoverageStats(coverage: PlanCoverage) {
  const watchable = coverage.games.filter((g) => g.status === "watchable").length
  const listenOnly = coverage.games.filter((g) => g.status === "listen-only").length
  const unavailable = coverage.games.filter((g) => g.status === "unavailable").length

  return {
    total: coverage.games.length,
    watchable,
    listenOnly,
    unavailable,
    watchablePercent:
      coverage.games.length > 0 ? Math.round((watchable / coverage.games.length) * 100) : 0,
  }
}
