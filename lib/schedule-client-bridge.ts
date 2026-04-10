/**
 * Browser-only overlay for canonical schedule: after hydration, `getEngineGames()` reads API-fed rows;
 * until then (or on failure) bundled ingest from `data-sources/games` is used.
 */

import type { Game } from "@/lib/types"
import type { DataFreshness, ScheduleValidationSummary } from "@/lib/data-sources/games"

export type ClientScheduleHydrationKind = "pending" | "success" | "failure"

export interface ScheduleClientSnapshot {
  kind: ClientScheduleHydrationKind
  /** Increments when hydration completes (success or failure) so consumers re-compute memoized schedule. */
  scheduleVersion: number
  isHydrating: boolean
  isReady: boolean
  loadError: string | null
  games: Game[]
  freshness: DataFreshness | null
  validation: ScheduleValidationSummary | null
  sourceUsed: DataFreshness["sourceUsed"] | null
  fallbackUsed: boolean | null
}

const initialSnapshot: ScheduleClientSnapshot = {
  kind: "pending",
  scheduleVersion: 0,
  isHydrating: true,
  isReady: false,
  loadError: null,
  games: [],
  freshness: null,
  validation: null,
  sourceUsed: null,
  fallbackUsed: null,
}

let snapshot: ScheduleClientSnapshot = { ...initialSnapshot }

/** Canonical client games from last successful API response (browser only). */
let clientCanonicalGames: Game[] | null = null

/**
 * True after the first hydration attempt finished (success or failure).
 * Until then, bundled schedule is used as boot fallback.
 */
let clientHydrationSettled = false

export function getScheduleState(): ScheduleClientSnapshot {
  return snapshot
}

export function getActiveEngineGames(bundledGetter: () => Game[]): Game[] {
  if (typeof window === "undefined") {
    return bundledGetter()
  }
  if (clientHydrationSettled && clientCanonicalGames !== null) {
    return clientCanonicalGames
  }
  return bundledGetter()
}

export interface CommitClientHydrationSuccessInput {
  games: Game[]
  freshness: DataFreshness
  validation: ScheduleValidationSummary
}

/**
 * Apply API result and bump snapshot for React subscribers.
 * Call from ScheduleProvider only.
 */
export function commitClientScheduleHydration(
  result:
    | { status: "success"; data: CommitClientHydrationSuccessInput }
    | { status: "failure"; error: string }
): void {
  if (typeof window === "undefined") return

  const nextVersion = snapshot.scheduleVersion + 1

  if (result.status === "success") {
    clientCanonicalGames = result.data.games
    clientHydrationSettled = true
    snapshot = {
      kind: "success",
      scheduleVersion: nextVersion,
      isHydrating: false,
      isReady: true,
      loadError: null,
      games: result.data.games,
      freshness: result.data.freshness,
      validation: result.data.validation,
      sourceUsed: result.data.freshness.sourceUsed ?? null,
      fallbackUsed: result.data.freshness.fallbackUsed ?? null,
    }
    return
  }

  clientCanonicalGames = null
  clientHydrationSettled = true
  snapshot = {
    kind: "failure",
    scheduleVersion: nextVersion,
    isHydrating: false,
    isReady: true,
    loadError: result.error,
    games: [],
    freshness: null,
    validation: null,
    sourceUsed: null,
    fallbackUsed: null,
  }
}

/** Test / HMR: reset module state */
export function resetClientScheduleBridgeForTests(): void {
  clientCanonicalGames = null
  clientHydrationSettled = false
  snapshot = { ...initialSnapshot }
}
