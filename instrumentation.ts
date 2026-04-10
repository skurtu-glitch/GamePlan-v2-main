/**
 * Server startup hook: hydrate schedule with remote → LKG → committed resolution before traffic.
 * Safe no-op on Edge / when hydration throws (committed bind from `bindDemoSchedule` remains).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  try {
    const { teams } = await import("@/lib/data")
    const { ensureServerScheduleHydrated } = await import(
      "@/lib/data-sources/schedule/server-hydrate"
    )
    await ensureServerScheduleHydrated(teams)
  } catch (e) {
    console.warn("[GamePlan] instrumentation schedule hydrate skipped.", e)
  }
}
