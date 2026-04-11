import type { DemoUserState } from "@/lib/demo-user"
import {
  getMonthlyUpgradeDelta,
  getOptimizerPlanById,
  type OptimizerScope,
} from "@/lib/optimizer-plans"
import { getPlanCoverage, type GameCoverage } from "@/lib/plan-coverage"
import { PROVIDER_LABEL } from "@/lib/streaming-service-ids"

export interface UpgradeImpact {
  id: string
  fromPlanId: string
  fromPlanName: string
  toPlanId: string
  toPlanName: string
  costDelta: number
  addedService: string
  addedServicePrice: string
  unlockedGames: UnlockedGame[]
}

export interface UnlockedGame {
  id: string
  matchup: string
  date: string
  time: string
  sport: "NHL" | "MLB"
  beforeStatus: "listen-only" | "unavailable"
  afterStatus: "watchable"
  newProvider: string
}

interface UpgradeDef {
  id: string
  fromPlanId: string
  toPlanId: string
  addedService: string
  addedServicePrice: string
}

const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: "blues-cheap-to-value",
    fromPlanId: "blues-cheapest",
    toPlanId: "blues-value",
    addedService: "Fubo Pro",
    addedServicePrice: "$79.99/mo",
  },
  {
    id: "blues-value-to-full",
    fromPlanId: "blues-value",
    toPlanId: "blues-full",
    addedService: PROVIDER_LABEL.MAX,
    addedServicePrice: "$9.99/mo",
  },
  {
    id: "cards-cheap-to-value",
    fromPlanId: "cardinals-cheapest",
    toPlanId: "cardinals-value",
    addedService: "Fubo Pro",
    addedServicePrice: "$79.99/mo",
  },
  {
    id: "cards-value-to-full",
    fromPlanId: "cardinals-value",
    toPlanId: "cardinals-full",
    addedService: PROVIDER_LABEL.MLB_TV,
    addedServicePrice: "$24.99/mo",
  },
  {
    id: "both-cheap-to-value",
    fromPlanId: "both-cheapest",
    toPlanId: "both-value",
    addedService: "Fubo Pro",
    addedServicePrice: "$79.99/mo",
  },
  {
    id: "both-value-to-full",
    fromPlanId: "both-value",
    toPlanId: "both-full",
    addedService: PROVIDER_LABEL.MAX,
    addedServicePrice: "$9.99/mo",
  },
]

/** Cap rows returned on `UpgradeImpact` (full count still available via stats). */
const UNLOCKED_GAMES_DISPLAY_CAP = 5

function teamFilterForPlan(planId: string): OptimizerScope | undefined {
  return getOptimizerPlanById(planId)?.scope
}

function shortUpgradeDate(row: GameCoverage): string {
  if (row.dateTimeIso) {
    return new Date(row.dateTimeIso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }
  const m = row.date.match(/([A-Za-z]{3})[, ]\s*(\d+)/)
  return m ? `${m[1]} ${m[2]}` : row.date
}

function unlockSport(row: GameCoverage): "NHL" | "MLB" {
  return row.sport === "MLB" ? "MLB" : "NHL"
}

function watchProviderAfterUpgrade(toRow: GameCoverage): string {
  return toRow.provider?.trim() || "—"
}

/**
 * Example matchups that move listen-only | unavailable → watchable between two plans, using
 * `getPlanCoverage` / `resolveGameAccess` (illustrative list; headline upgrade stats use season catalog).
 */
export function computeUnlockedGamesForUpgrade(
  fromPlanId: string,
  toPlanId: string,
  liveUser?: DemoUserState
): UnlockedGame[] {
  const scope = teamFilterForPlan(fromPlanId)
  const toScope = teamFilterForPlan(toPlanId)
  if (!scope || scope !== toScope) return []

  const fromCov = getPlanCoverage(fromPlanId, scope, liveUser)
  const toCov = getPlanCoverage(toPlanId, scope, liveUser)
  const toById = new Map(toCov.games.map((g) => [g.id, g]))
  const out: UnlockedGame[] = []

  for (const fromG of fromCov.games) {
    const toG = toById.get(fromG.id)
    if (!toG) continue

    const wasNotWatchable = fromG.status === "listen-only" || fromG.status === "unavailable"
    if (!wasNotWatchable || toG.status !== "watchable") continue

    out.push({
      id: fromG.id,
      matchup: `${fromG.awayTeam} @ ${fromG.homeTeam}`,
      date: shortUpgradeDate(fromG),
      time: fromG.time,
      sport: unlockSport(fromG),
      beforeStatus: fromG.status === "listen-only" ? "listen-only" : "unavailable",
      afterStatus: "watchable",
      newProvider: watchProviderAfterUpgrade(toG),
    })
  }

  return out
}

function buildUpgradeImpact(def: UpgradeDef, liveUser?: DemoUserState): UpgradeImpact {
  const from = getOptimizerPlanById(def.fromPlanId)
  const to = getOptimizerPlanById(def.toPlanId)
  const allUnlocked = computeUnlockedGamesForUpgrade(
    def.fromPlanId,
    def.toPlanId,
    liveUser
  )
  return {
    id: def.id,
    fromPlanId: def.fromPlanId,
    fromPlanName: from?.name ?? def.fromPlanId,
    toPlanId: def.toPlanId,
    toPlanName: to?.name ?? def.toPlanId,
    costDelta: getMonthlyUpgradeDelta(def.fromPlanId, def.toPlanId),
    addedService: def.addedService,
    addedServicePrice: def.addedServicePrice,
    unlockedGames: allUnlocked.slice(0, UNLOCKED_GAMES_DISPLAY_CAP),
  }
}

export function getUpgradeImpact(
  upgradeId: string,
  liveUser?: DemoUserState
): UpgradeImpact | undefined {
  const def = UPGRADE_DEFS.find((u) => u.id === upgradeId)
  if (!def) return undefined
  return buildUpgradeImpact(def, liveUser)
}

/** Upgrade Impact page id whose destination catalog plan matches `toPlanId` (e.g. `both-value` → `both-cheap-to-value`). */
export function getUpgradeImpactIdForDestinationPlan(toPlanId: string): string | undefined {
  return UPGRADE_DEFS.find((u) => u.toPlanId === toPlanId)?.id
}

export function getUpgradesFromPlan(
  planId: string,
  liveUser?: DemoUserState
): UpgradeImpact[] {
  return UPGRADE_DEFS.filter((u) => u.fromPlanId === planId).map((d) =>
    buildUpgradeImpact(d, liveUser)
  )
}

export interface UpgradeImpactStats {
  /** Additional watchable games this season (catalog `to` − `from`). */
  newlyWatchable: number
  costDelta: number
  costPerNewGame: number
  /** Same as `catalogCurrentWatchable` (legacy field for callers). */
  currentWatchable: number
  upgradedWatchable: number
  totalGames: number
  catalogTotalGames: number
  catalogCurrentWatchable: number
  catalogUpgradedWatchable: number
  catalogCurrentPercent: number
  catalogUpgradedPercent: number
}

export function getUpgradeImpactStats(upgrade: UpgradeImpact): UpgradeImpactStats {
  const fromPlan = getOptimizerPlanById(upgrade.fromPlanId)
  const toPlan = getOptimizerPlanById(upgrade.toPlanId)

  const catalogTotalGames = fromPlan?.totalGames ?? toPlan?.totalGames ?? 0
  const catalogCurrentWatchable = fromPlan?.gamesWatchable ?? 0
  const catalogUpgradedWatchable = toPlan?.gamesWatchable ?? 0
  const catalogCurrentPercent = fromPlan?.coveragePercent ?? 0
  const catalogUpgradedPercent = toPlan?.coveragePercent ?? 0

  const newlyWatchable = Math.max(
    0,
    catalogUpgradedWatchable - catalogCurrentWatchable
  )
  const costPerNewGame =
    newlyWatchable > 0
      ? Math.round((upgrade.costDelta / newlyWatchable) * 100) / 100
      : 0

  return {
    newlyWatchable,
    costDelta: upgrade.costDelta,
    costPerNewGame,
    currentWatchable: catalogCurrentWatchable,
    upgradedWatchable: catalogUpgradedWatchable,
    totalGames: catalogTotalGames,
    catalogTotalGames,
    catalogCurrentWatchable,
    catalogUpgradedWatchable,
    catalogCurrentPercent,
    catalogUpgradedPercent,
  }
}
