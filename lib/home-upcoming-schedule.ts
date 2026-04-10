/**
 * Home upcoming list: sort, cap, league grouping, and resolver-aligned watch counts.
 */

import type { DemoUserState } from "@/lib/demo-user"
import type { Game } from "@/lib/types"
import { resolveGameAccess } from "@/lib/resolve-game-access"

/** Max upcoming rows shown on Home (after tonight), across leagues. */
export const HOME_UPCOMING_SAMPLE_CAP = 10

export function sortGamesByStartTime(games: readonly Game[]): Game[] {
  return [...games].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  )
}

/** Split games by home team league (catalog NHL / MLB) — Home sample or full Schedule list. */
export function groupUpcomingSampleByLeague(games: readonly Game[]): {
  nhl: Game[]
  mlb: Game[]
} {
  const nhl: Game[] = []
  const mlb: Game[] = []
  for (const g of games) {
    if (g.homeTeam.league === "NHL") nhl.push(g)
    else if (g.homeTeam.league === "MLB") mlb.push(g)
  }
  return { nhl, mlb }
}

/** Alias for the full Schedule page (same NHL / MLB grouping as Home). */
export const groupScheduleGamesByLeague = groupUpcomingSampleByLeague

/**
 * Watchable count for the Home upcoming sample using {@link resolveGameAccess}
 * (same path as row CTAs).
 */
export function upcomingSampleWatchCounts(
  games: readonly Game[],
  userState: DemoUserState
): { watchable: number; total: number } {
  let watchable = 0
  for (const g of games) {
    if (resolveGameAccess(g, userState).status === "watchable") watchable++
  }
  return { watchable, total: games.length }
}

/** One-line copy for the upcoming sample summary. */
export function formatUpcomingWatchSummaryLine(watchable: number, total: number): string {
  if (total <= 0) return ""
  if (watchable === total) {
    return total === 1
      ? "You can watch the 1 upcoming game on video with your current setup."
      : `You can watch all ${total} upcoming games on video with your current setup.`
  }
  return `You can watch ${watchable} of ${total} upcoming games on video with your current setup.`
}

/** Short follow-up when some upcoming games are not watchable on video (resolver-aligned rows). */
export function formatUpcomingWatchSecondaryLine(watchable: number, total: number): string | null {
  if (total <= 0 || watchable >= total) return null
  return "The rest are listen-only or not available on video with your current subscriptions."
}
