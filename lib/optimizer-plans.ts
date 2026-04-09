export type OptimizerScope = "blues" | "cardinals" | "both"

export type OptimizerTier = "cheapest" | "value" | "full" | "radio"

export interface OptimizerPlan {
  id: string
  name: string
  monthlyCost: number
  /** Connected-service ids (same as game.watch.providers & demo user). */
  servicesIncluded: string[]
  gamesWatchable: number
  gamesListenOnly: number
  totalGames: number
  coveragePercent: number
  tier: OptimizerTier
  scope: OptimizerScope
  explanation: string
}

const TIER_ORDER: Record<OptimizerTier, number> = {
  cheapest: 0,
  value: 1,
  full: 2,
  radio: 3,
}

export const NHL_REGULAR_SEASON_GAMES = 82
export const MLB_REGULAR_SEASON_GAMES = 162

const SEASON_TOTAL_BOTH = NHL_REGULAR_SEASON_GAMES + MLB_REGULAR_SEASON_GAMES

function p(watchable: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((watchable / total) * 100)
}

const BLUES_CHEAP_LISTEN = NHL_REGULAR_SEASON_GAMES - 33
const BLUES_VALUE_LISTEN = NHL_REGULAR_SEASON_GAMES - 74
const CARDS_CHEAP_LISTEN = MLB_REGULAR_SEASON_GAMES - 81
const CARDS_VALUE_LISTEN = MLB_REGULAR_SEASON_GAMES - 146
const BOTH_CHEAP_LISTEN = SEASON_TOTAL_BOTH - 114
const BOTH_VALUE_LISTEN = SEASON_TOTAL_BOTH - 220

/** Single source of truth for optimizer tiers (season-level counts). Radio is always last per scope. */
export const ALL_OPTIMIZER_PLANS: OptimizerPlan[] = [
  {
    id: "blues-cheapest",
    name: "Cheapest",
    tier: "cheapest",
    scope: "blues",
    monthlyCost: 10.99,
    servicesIncluded: ["espn-plus"],
    gamesWatchable: 33,
    gamesListenOnly: BLUES_CHEAP_LISTEN,
    totalGames: NHL_REGULAR_SEASON_GAMES,
    coveragePercent: p(33, NHL_REGULAR_SEASON_GAMES),
    explanation:
      "Best for casual fans — covers all out-of-market games at the lowest cost",
  },
  {
    id: "blues-value",
    name: "Best Value",
    tier: "value",
    scope: "blues",
    monthlyCost: 79.99,
    servicesIncluded: ["fanduel-sports", "espn-plus"],
    gamesWatchable: 74,
    gamesListenOnly: BLUES_VALUE_LISTEN,
    totalGames: NHL_REGULAR_SEASON_GAMES,
    coveragePercent: p(74, NHL_REGULAR_SEASON_GAMES),
    explanation:
      "Watch 90% of games including local broadcasts — the sweet spot for most fans",
  },
  {
    id: "blues-full",
    name: "Full Coverage",
    tier: "full",
    scope: "blues",
    monthlyCost: 90.98,
    servicesIncluded: ["fanduel-sports", "espn-plus", "max"],
    gamesWatchable: 82,
    gamesListenOnly: 0,
    totalGames: NHL_REGULAR_SEASON_GAMES,
    coveragePercent: 100,
    explanation: "Never miss a game — complete coverage across all platforms",
  },
  {
    id: "blues-radio",
    name: "Radio Only",
    tier: "radio",
    scope: "blues",
    monthlyCost: 0,
    servicesIncluded: ["team-radio"],
    gamesWatchable: 0,
    gamesListenOnly: NHL_REGULAR_SEASON_GAMES,
    totalGames: NHL_REGULAR_SEASON_GAMES,
    coveragePercent: 0,
    explanation: "Follow every game for free with audio coverage",
  },

  {
    id: "cardinals-cheapest",
    name: "Cheapest",
    tier: "cheapest",
    scope: "cardinals",
    monthlyCost: 24.99,
    servicesIncluded: ["mlb-tv"],
    gamesWatchable: 81,
    gamesListenOnly: CARDS_CHEAP_LISTEN,
    totalGames: MLB_REGULAR_SEASON_GAMES,
    coveragePercent: p(81, MLB_REGULAR_SEASON_GAMES),
    explanation: "Great for out-of-market fans — strong watch coverage at a low cost",
  },
  {
    id: "cardinals-value",
    name: "Best Value",
    tier: "value",
    scope: "cardinals",
    monthlyCost: 79.99,
    servicesIncluded: ["fanduel-sports", "espn-plus"],
    gamesWatchable: 146,
    gamesListenOnly: CARDS_VALUE_LISTEN,
    totalGames: MLB_REGULAR_SEASON_GAMES,
    coveragePercent: p(146, MLB_REGULAR_SEASON_GAMES),
    explanation: "Watch 90% of games with local RSN — ideal for local fans",
  },
  {
    id: "cardinals-full",
    name: "Full Coverage",
    tier: "full",
    scope: "cardinals",
    monthlyCost: 104.98,
    servicesIncluded: ["fanduel-sports", "espn-plus", "mlb-tv"],
    gamesWatchable: 162,
    gamesListenOnly: 0,
    totalGames: MLB_REGULAR_SEASON_GAMES,
    coveragePercent: 100,
    explanation: "Every single game — home, away, and national broadcasts",
  },
  {
    id: "cardinals-radio",
    name: "Radio Only",
    tier: "radio",
    scope: "cardinals",
    monthlyCost: 0,
    servicesIncluded: ["team-radio"],
    gamesWatchable: 0,
    gamesListenOnly: MLB_REGULAR_SEASON_GAMES,
    totalGames: MLB_REGULAR_SEASON_GAMES,
    coveragePercent: 0,
    explanation: "Classic radio coverage for the entire 162-game season",
  },

  {
    id: "both-cheapest",
    name: "Cheapest",
    tier: "cheapest",
    scope: "both",
    monthlyCost: 35.98,
    servicesIncluded: ["espn-plus", "mlb-tv"],
    gamesWatchable: 114,
    gamesListenOnly: BOTH_CHEAP_LISTEN,
    totalGames: SEASON_TOTAL_BOTH,
    coveragePercent: p(114, SEASON_TOTAL_BOTH),
    explanation: "Budget-friendly multi-sport coverage for out-of-market games",
  },
  {
    id: "both-value",
    name: "Best Value",
    tier: "value",
    scope: "both",
    monthlyCost: 90.98,
    servicesIncluded: ["fanduel-sports", "espn-plus", "mlb-tv"],
    gamesWatchable: 220,
    gamesListenOnly: BOTH_VALUE_LISTEN,
    totalGames: SEASON_TOTAL_BOTH,
    coveragePercent: p(220, SEASON_TOTAL_BOTH),
    explanation: "Watch 90% of both teams — the best balance of coverage and cost",
  },
  {
    id: "both-full",
    name: "Full Coverage",
    tier: "full",
    scope: "both",
    monthlyCost: 115.97,
    servicesIncluded: ["fanduel-sports", "espn-plus", "mlb-tv", "max"],
    gamesWatchable: 244,
    gamesListenOnly: 0,
    totalGames: SEASON_TOTAL_BOTH,
    coveragePercent: 100,
    explanation: "Complete coverage — never miss a Blues or Cardinals game",
  },
  {
    id: "both-radio",
    name: "Radio Only",
    tier: "radio",
    scope: "both",
    monthlyCost: 0,
    servicesIncluded: ["team-radio"],
    gamesWatchable: 0,
    gamesListenOnly: SEASON_TOTAL_BOTH,
    totalGames: SEASON_TOTAL_BOTH,
    coveragePercent: 0,
    explanation: "Free audio coverage for all 244 games across both teams",
  },
]

export function getOptimizerPlanById(id: string): OptimizerPlan | undefined {
  return ALL_OPTIMIZER_PLANS.find((p) => p.id === id)
}

export function getPlansForScope(scope: OptimizerScope): OptimizerPlan[] {
  return ALL_OPTIMIZER_PLANS.filter((p) => p.scope === scope).sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
  )
}

export function getAnnualCost(plan: OptimizerPlan): number {
  return Math.round(plan.monthlyCost * 12 * 100) / 100
}

/** Monthly price delta between two catalog plans (upgrade cost step). */
export function getMonthlyUpgradeDelta(fromPlanId: string, toPlanId: string): number {
  const from = getOptimizerPlanById(fromPlanId)
  const to = getOptimizerPlanById(toPlanId)
  if (!from || !to) return 0
  return Math.round((to.monthlyCost - from.monthlyCost) * 100) / 100
}
