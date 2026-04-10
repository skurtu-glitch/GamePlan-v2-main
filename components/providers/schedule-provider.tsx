"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Game } from "@/lib/types"
import type { DataFreshness, ScheduleValidationSummary } from "@/lib/data-sources/games"
import {
  commitClientScheduleHydration,
  getScheduleState,
  type ScheduleClientSnapshot,
} from "@/lib/schedule-client-bridge"

export { getScheduleState } from "@/lib/schedule-client-bridge"

const ScheduleContext = createContext<ScheduleClientSnapshot | null>(null)

const CANONICAL_SCHEDULE_URL = "/api/gameplan/schedule?debug=1"

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)

  const snapshot = useMemo(() => getScheduleState(), [version])

  const bump = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(CANONICAL_SCHEDULE_URL, { cache: "no-store" })
        const json = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          throw new Error(
            typeof json.error === "string" ? json.error : `HTTP ${res.status}`
          )
        }
        const games = json.games
        if (!Array.isArray(games)) {
          throw new Error("Schedule API response missing games array")
        }
        commitClientScheduleHydration({
          status: "success",
          data: {
            games: games as Game[],
            freshness: json.freshness as DataFreshness,
            validation: json.validation as ScheduleValidationSummary,
          },
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn("[GamePlan] Client schedule hydration failed; using bundled fallback.", e)
        commitClientScheduleHydration({ status: "failure", error: msg })
      } finally {
        if (!cancelled) bump()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bump])

  return (
    <ScheduleContext.Provider value={snapshot}>{children}</ScheduleContext.Provider>
  )
}

export function useSchedule(): ScheduleClientSnapshot {
  const ctx = useContext(ScheduleContext)
  if (!ctx) {
    throw new Error("useSchedule must be used within ScheduleProvider")
  }
  return ctx
}

/** Optional: subscribe without throwing when provider is absent (e.g. tests). */
export function useScheduleOptional(): ScheduleClientSnapshot | null {
  return useContext(ScheduleContext)
}

/** Minimal pulse block for schedule-dependent UI while canonical data loads. */
export function ScheduleHydrationSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "space-y-3 rounded-xl border border-border/60 bg-card/40 p-4 animate-pulse"
      }
    >
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-24 rounded-lg bg-muted/80" />
      <div className="h-16 rounded-lg bg-muted/60" />
    </div>
  )
}
