/**
 * Shared conversion copy: urgency, outcomes, bundle phrasing, social proof.
 * No optimizer/resolver logic — strings and light time checks only.
 */

import type { Game, Team } from "@/lib/types"
import { serviceDisplayName } from "@/lib/streaming-service-ids"

export const URGENCY_HOURS = 24

export function isGameWithinHours(
  isoDate: string,
  hours: number,
  now = new Date()
): boolean {
  const t = new Date(isoDate).getTime()
  if (!Number.isFinite(t)) return false
  const ms = hours * 60 * 60 * 1000
  const delta = t - now.getTime()
  return delta >= 0 && delta <= ms
}

/** First user-followed team name on the game (fallback: away team). */
export function urgencyTeamLabel(
  game: Pick<Game, "homeTeam" | "awayTeam">,
  userTeamIds: ReadonlySet<string>
): string {
  if (userTeamIds.has(game.homeTeam.id)) return game.homeTeam.name
  if (userTeamIds.has(game.awayTeam.id)) return game.awayTeam.name
  return game.homeTeam.name
}

export function missTonightUrgencyLine(teamName: string): string {
  return `Miss tonight’s ${teamName} game → fix this now`
}

export function seasonUnlockBanner(): string {
  return "Unlock more games this season"
}

export function valueJustificationCheapest(): string {
  return "Lowest-cost way to watch most of your games"
}

export function valueJustificationBestValue(): string {
  return "Best value for your teams"
}

export function socialProofMostFans(): string {
  return "Most fans choose this option"
}

export function socialProofRecommended(): string {
  return "Recommended for your teams"
}

/** Bundle line: Service A + Service B + … */
export function formatBundlePlusList(serviceIds: readonly string[]): string {
  return serviceIds.map(serviceDisplayName).join(" + ")
}

export function labelFixMyCoverage(): string {
  return "Fix my coverage"
}

export function labelGetBestValue(): string {
  return "Get Best Value"
}

export function labelReviewDetails(): string {
  return "Review details"
}

export function labelUnlockMoreGames(): string {
  return "Unlock more games"
}

export function labelWatchTonightsGame(): string {
  return "Watch tonight’s game"
}

export function labelGetBestValuePlan(): string {
  return "Get Best Value plan"
}

/** Home / assistant when the next step is browsing the schedule at `/`. */
export function labelSeeHomeSchedule(): string {
  return "See your home schedule"
}

/**
 * Primary monetization CTA label for plan surfaces.
 * - Near-term game window → watch tonight
 * - Catalog “Best Value” name → get that plan
 * - Otherwise → unlock games
 */
export function chooseMonetizedPrimaryLabel(opts: {
  within24h: boolean
  planName: string
}): string {
  if (opts.within24h) return labelWatchTonightsGame()
  if (opts.planName === "Best Value") return labelGetBestValuePlan()
  return labelUnlockMoreGames()
}
