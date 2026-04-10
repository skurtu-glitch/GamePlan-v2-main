/**
 * Deterministic watch-question routing: map natural language + engine schedule → game id.
 * No LLM; uses `getEngineGames()` (same source as Home / Game Detail).
 */

import { getEngineGames, teamsForFollowedIds } from "@/lib/data"
import type { DemoUserState } from "@/lib/demo-user"
import type { OptimizerScope } from "@/lib/optimizer-plans"
import type { Game } from "@/lib/types"

const BLUES_ID = "stl-blues"
const CARDINALS_ID = "stl-cardinals"

export type WatchTeamIntent = "blues" | "cardinals" | "both"

export function hasWordBlues(n: string): boolean {
  return /\bblues\b/.test(n)
}

export function hasWordCardinals(n: string): boolean {
  return /\bcardinals\b/.test(n) || /\bcardinal\b/.test(n)
}

function inferWatchTeamIntent(n: string): WatchTeamIntent | null {
  const blues = hasWordBlues(n)
  const cards = hasWordCardinals(n)
  if (!blues && !cards) return null
  if (blues && cards) return "both"
  if (blues) return "blues"
  return "cardinals"
}

function userRelevantGames(games: Game[], userState: DemoUserState): Game[] {
  const followed = teamsForFollowedIds(userState.followedTeamIds)
  return games.filter((game) =>
    followed.some(
      (team) => team.id === game.homeTeam.id || team.id === game.awayTeam.id
    )
  )
}

function filterByTeamIntent(games: Game[], intent: WatchTeamIntent): Game[] {
  if (intent === "blues") {
    return games.filter(
      (g) => g.homeTeam.id === BLUES_ID || g.awayTeam.id === BLUES_ID
    )
  }
  if (intent === "cardinals") {
    return games.filter(
      (g) => g.homeTeam.id === CARDINALS_ID || g.awayTeam.id === CARDINALS_ID
    )
  }
  return games.filter(
    (g) =>
      g.homeTeam.id === BLUES_ID ||
      g.awayTeam.id === BLUES_ID ||
      g.homeTeam.id === CARDINALS_ID ||
      g.awayTeam.id === CARDINALS_ID
  )
}

function sameLocalCalendarDay(gameIso: string, now: Date): boolean {
  return new Date(gameIso).toDateString() === now.toDateString()
}

function sortByStartTimeAsc(games: Game[]): Game[] {
  return [...games].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  )
}

/**
 * Prefer same local calendar day as `now` (tonight / today), earliest tip first;
 * else earliest game with start >= `now`.
 */
function pickPreferredGameId(candidates: Game[], now: Date): string | undefined {
  if (candidates.length === 0) return undefined

  const tonight = candidates.filter((g) => sameLocalCalendarDay(g.dateTime, now))
  if (tonight.length > 0) return tonight[0].id

  const t0 = now.getTime()
  const upcoming = candidates.filter((g) => new Date(g.dateTime).getTime() >= t0)
  if (upcoming.length > 0) return upcoming[0].id

  return undefined
}

/** Next relevant engine game id for a Blues / Cardinals / both scope (tonight first, then upcoming). */
export function resolveEngineGameIdForTeamWatch(
  intent: WatchTeamIntent,
  now: Date,
  userState: DemoUserState
): string | undefined {
  const candidates = sortByStartTimeAsc(
    filterByTeamIntent(userRelevantGames(getEngineGames(), userState), intent)
  )
  return pickPreferredGameId(candidates, now)
}

/**
 * Map optimizer scope to a watch game id using the live schedule and the user’s followed teams.
 */
export function resolveGameIdForTeamIntent(
  scope: OptimizerScope,
  userState: DemoUserState,
  now: Date
): string | undefined {
  const intent: WatchTeamIntent =
    scope === "blues" ? "blues" : scope === "cardinals" ? "cardinals" : "both"
  return resolveEngineGameIdForTeamWatch(intent, now, userState)
}

/**
 * Pick one engine game id for a watch-style query (team words in the string).
 * 1) Same local calendar day as `now`, earliest start first.
 * 2) Else earliest game with start >= `now`.
 */
export function resolveEngineGameIdForWatchQuery(
  normalizedQuery: string,
  now: Date,
  userState: DemoUserState
): string | undefined {
  const intent = inferWatchTeamIntent(normalizedQuery)
  if (!intent) return undefined
  return resolveEngineGameIdForTeamWatch(intent, now, userState)
}
