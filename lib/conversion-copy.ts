/**
 * Shared conversion copy: urgency, outcomes, bundle phrasing, social proof.
 * No optimizer/resolver logic — strings and light time checks only.
 */

import type { Game, Team } from "@/lib/types"
import type { ResolvedGameAccess } from "@/lib/resolve-game-access"
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

export function labelSeeAllPlans(): string {
  return "See all plans"
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

/** Plans list: single optimizer-led highlight (same plan as `bestValuePlanId`). */
export function labelBestForYourSetup(): string {
  return "Best for your setup"
}

/** Under the highlighted plan when catalog unlock vs baseline is positive. */
export function planListBestForYouUnlockReason(): string {
  return "This gives you the biggest increase in watchable games."
}

/** When the highlighted plan has no incremental catalog unlock (already covered). */
export function planListBestForYouGuidedFallbackReason(): string {
  return "Our guided pick from your current subscriptions — compare details here first."
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

/** Primary upgrade line: season-catalog delta in watchable games. */
export function upgradePrimaryWatchMoreGames(count: number): string {
  if (count <= 0) return "Watch more games"
  return count === 1 ? "Watch 1 more game" : `Watch ${count} more games`
}

/** Secondary line shared across Home, Plans, Plan detail, and Upgrade. */
export function upgradeSecondaryFullSeason(): string {
  return "Based on the full season schedule"
}

export function upgradeUnlockAdditionalGamesSeason(count: number): string {
  if (count <= 0) return "Unlock additional games this season"
  return count === 1
    ? "Unlock 1 additional game this season"
    : `Unlock ${count} additional games this season`
}

function formatUsdAmountTrimmed(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "0"
  const x = Math.round(amount * 100) / 100
  if (Number.isInteger(x)) return String(x)
  return x.toFixed(2).replace(/\.?0+$/, "")
}

/**
 * Full phrasing for upgrade cards / detail (list-price catalog step ÷ newly watchable games).
 */
export function upgradeCostPerAdditionalGameLine(costPerNewGame: number): string | null {
  if (!Number.isFinite(costPerNewGame) || costPerNewGame <= 0) return null
  return `~$${formatUsdAmountTrimmed(costPerNewGame)} per additional game`
}

/** Shorter line paired with “Watch N more games” (same dollars as {@link upgradeCostPerAdditionalGameLine}). */
export function upgradeCostPerGameCompactLine(costPerNewGame: number): string | null {
  if (!Number.isFinite(costPerNewGame) || costPerNewGame <= 0) return null
  return `~$${formatUsdAmountTrimmed(costPerNewGame)} per game`
}

/** Positive list-price monthly delta for an upgrade step. */
export function upgradeAboutMonthlyMoreLine(monthlyDelta: number): string | null {
  if (!Number.isFinite(monthlyDelta) || monthlyDelta <= 0) return null
  return `About +$${formatUsdAmountTrimmed(monthlyDelta)}/month`
}

export function formatUpgradeBeforeAfterWatchableLines(
  currentWatchable: number,
  planWatchable: number
): { before: string; after: string } {
  const cg = currentWatchable === 1 ? "game" : "games"
  const pg = planWatchable === 1 ? "game" : "games"
  return {
    before: `You can currently watch ${currentWatchable} ${cg}`,
    after: `This plan lets you watch ${planWatchable} ${pg}`,
  }
}

/**
 * Home schedule rows: outcome labels without changing resolver destinations.
 */
export function homeGameRowPrimaryLabel(access: ResolvedGameAccess): string {
  if (access.status === "watchable") {
    const { label } = access.primaryAction
    if (label.startsWith("Watch on ")) return label
    return "Watch this game"
  }
  if (access.status === "listen-only") {
    return access.primaryAction.label
  }
  return labelFixMyCoverage()
}
