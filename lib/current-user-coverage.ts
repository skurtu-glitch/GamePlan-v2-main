/**
 * Single source of truth for **current-user** coverage on the **live demo schedule**:
 * {@link getEngineGames} ∩ scope, then {@link resolveGameAccess} per row (subscriptions + market rules).
 *
 * Catalog plan rows (`OptimizerPlan.gamesWatchable`, {@link getCurrentCoverageBaseline}) stay separate
 * for hypothetical bundles and optimizer unlock math — do not use those for “your watchable games” UI.
 */

import { getEngineGames } from "@/lib/data"
import type { DemoUserState } from "@/lib/demo-user"
import type { OptimizerScope } from "@/lib/optimizer-plans"
import {
  resolveGameAccess,
  type ResolvedGameAccess,
} from "@/lib/resolve-game-access"
import type { Game } from "@/lib/types"

const BLUES_ID = "stl-blues"
const CARDINALS_ID = "stl-cardinals"

/** Engine games that belong to the Plan Optimizer scope (demo Blues / Cardinals / both). */
export function gameMatchesOptimizerScope(game: Game, scope: OptimizerScope): boolean {
  if (scope === "both") {
    return (
      game.homeTeam.id === BLUES_ID ||
      game.awayTeam.id === BLUES_ID ||
      game.homeTeam.id === CARDINALS_ID ||
      game.awayTeam.id === CARDINALS_ID
    )
  }
  if (scope === "blues") {
    return game.homeTeam.id === BLUES_ID || game.awayTeam.id === BLUES_ID
  }
  return game.homeTeam.id === CARDINALS_ID || game.awayTeam.id === CARDINALS_ID
}

export function getEngineGamesForOptimizerScope(scope: OptimizerScope): Game[] {
  return getEngineGames().filter((g) => gameMatchesOptimizerScope(g, scope))
}

export interface ResolverCoverageCounts {
  gamesWatchable: number
  gamesListenOnly: number
  gamesUnavailable: number
  totalGames: number
  coveragePercent: number
}

/** Count watch / listen / unavailable using the same resolver as Home and Game Detail. */
export function summarizeResolverCoverageForGames(
  games: readonly Game[],
  userState: DemoUserState
): ResolverCoverageCounts {
  let gamesWatchable = 0
  let gamesListenOnly = 0
  let gamesUnavailable = 0
  for (const game of games) {
    const s = resolveGameAccess(game, userState).status
    if (s === "watchable") gamesWatchable++
    else if (s === "listen-only") gamesListenOnly++
    else gamesUnavailable++
  }
  const totalGames = games.length
  const coveragePercent =
    totalGames > 0 ? Math.round((gamesWatchable / totalGames) * 100) : 0
  return {
    gamesWatchable,
    gamesListenOnly,
    gamesUnavailable,
    totalGames,
    coveragePercent,
  }
}

export interface CurrentUserCoverageSummary extends ResolverCoverageCounts {
  scope: OptimizerScope
}

/** Season-style summary for the **games present in the app schedule** for this scope. */
export function getCurrentUserCoverageSummary(
  scope: OptimizerScope,
  userState: DemoUserState
): CurrentUserCoverageSummary {
  const games = getEngineGamesForOptimizerScope(scope)
  const counts = summarizeResolverCoverageForGames(games, userState)
  return { scope, ...counts }
}

/** Per-team slice of the live schedule (any game involving `teamId`). */
export function getCurrentUserTeamCoverage(
  teamId: string,
  userState: DemoUserState
): ResolverCoverageCounts {
  const games = getEngineGames().filter(
    (g) => g.homeTeam.id === teamId || g.awayTeam.id === teamId
  )
  return summarizeResolverCoverageForGames(games, userState)
}

export function getCurrentUserGameAccess(
  gameId: string,
  userState: DemoUserState
): ResolvedGameAccess | null {
  const game = getEngineGames().find((g) => g.id === gameId)
  if (!game) return null
  return resolveGameAccess(game, userState)
}

export function getCurrentUserWatchableGames(
  scope: OptimizerScope,
  userState: DemoUserState
): Game[] {
  return getEngineGamesForOptimizerScope(scope).filter(
    (g) => resolveGameAccess(g, userState).status === "watchable"
  )
}
