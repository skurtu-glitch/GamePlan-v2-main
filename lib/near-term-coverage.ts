/**
 * Near-term (rolling calendar window) coverage using live schedule rows from {@link getEngineGames}.
 * Complements season + synthetic sample schedules in `plan-coverage.ts`.
 */

import {
  gameMatchesOptimizerScope,
  summarizeResolverCoverageForGames,
} from "@/lib/current-user-coverage"
import type { DemoUserState } from "@/lib/demo-user"
import { demoUserWithConnectedServiceIds } from "@/lib/demo-user"
import { getEngineGames } from "@/lib/data-sources/games"
import type { OptimizerScope } from "@/lib/optimizer-plans"
import { resolveGameAccess } from "@/lib/resolve-game-access"
import type { SampleTransitionCounts } from "@/lib/plan-coverage"
import type { Game } from "@/lib/types"

/** Default horizon for optimizer + Home “immediate relevance” signals. */
export const DEFAULT_NEAR_TERM_OPTIMIZER_DAYS = 7

function startEndForWindow(days: number, now: Date): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days)
  return { start, end }
}

/**
 * Engine `Game` rows in `[start of today, start of today + days)` that match `scope` team filters
 * (Blues, Cardinals, or both demo teams).
 */
export function getNearTermEngineGamesForScope(
  scope: OptimizerScope,
  days: number,
  now: Date = new Date()
): Game[] {
  const { start, end } = startEndForWindow(days, now)
  const t0 = start.getTime()
  const t1 = end.getTime()
  return getEngineGames()
    .filter((g) => {
      const t = new Date(g.dateTime).getTime()
      return t >= t0 && t < t1 && gameMatchesOptimizerScope(g, scope)
    })
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
}

export interface UpcomingCoverageWindow {
  scope: OptimizerScope
  days: number
  gamesWatchable: number
  gamesListenOnly: number
  gamesUnavailable: number
  totalGames: number
  coveragePercent: number
}

/** Resolver counts on real upcoming games in the window (Home / copy / diagnostics). */
export function getUpcomingCoverageWindow(
  scope: OptimizerScope,
  userState: DemoUserState,
  days: number = DEFAULT_NEAR_TERM_OPTIMIZER_DAYS,
  now: Date = new Date()
): UpcomingCoverageWindow {
  const games = getNearTermEngineGamesForScope(scope, days, now)
  const counts = summarizeResolverCoverageForGames(games, userState)
  return {
    scope,
    days,
    ...counts,
  }
}

/**
 * Pairwise near-term comparison: current user vs candidate services, same transition semantics as
 * {@link getSampleTransitionCounts}.
 */
export function getNearTermTransitionCounts(
  scope: OptimizerScope,
  fromState: DemoUserState,
  toServiceIds: string[],
  days: number,
  now: Date = new Date()
): SampleTransitionCounts {
  const toState = demoUserWithConnectedServiceIds(fromState, toServiceIds)
  let newlyWatchableGames = 0
  let newlyListenableGames = 0
  let lostWatchableGames = 0
  let lostListenableGames = 0

  for (const game of getNearTermEngineGamesForScope(scope, days, now)) {
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
