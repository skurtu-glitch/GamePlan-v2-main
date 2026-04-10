import { NextResponse } from "next/server"
import { teams } from "@/lib/data"
import { getDataFreshness, getEngineGames, getLastScheduleValidation } from "@/lib/data-sources/games"
import {
  ensureServerScheduleHydrated,
  runOperationalScheduleRefresh,
} from "@/lib/data-sources/schedule/server-hydrate"

/**
 * GET — ops status + game count; hydrates server schedule once per process (remote → LKG → committed).
 * `?debug=1` includes full `games` (ops only).
 * POST — operational refresh (remote fetch, validate, LKG write, in-memory bind); optional `secret` when env set.
 */
export async function GET(req: Request) {
  try {
    await ensureServerScheduleHydrated(teams)
  } catch (e) {
    console.warn("[GamePlan] Schedule hydration skipped/failed on GET.", e)
  }

  const url = new URL(req.url)
  const debug = url.searchParams.get("debug") === "1"
  const freshness = getDataFreshness()
  const validation = getLastScheduleValidation()
  const payload: Record<string, unknown> = {
    freshness,
    validation,
    gameCount: getEngineGames().length,
    sourceUsed: freshness.sourceUsed,
    fallbackUsed: freshness.fallbackUsed,
  }
  if (debug) payload.games = getEngineGames()
  return NextResponse.json(payload)
}

export async function POST(req: Request) {
  const cronSecret = process.env.GAMEPLAN_PIPELINE_CRON_SECRET
  let body: { secret?: string; force?: boolean; includeGames?: boolean } = {}
  try {
    body = (await req.json()) as { secret?: string; force?: boolean; includeGames?: boolean }
  } catch {
    body = {}
  }
  if (cronSecret && body.secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runOperationalScheduleRefresh(teams, { force: Boolean(body.force) })
    const freshness = getDataFreshness()
    /** Default true for backward compatibility with cron previews; set `includeGames: false` to omit. */
    const includeGames = body.includeGames !== false
    const fetchedAt = new Date().toISOString()
    const anchorUsed = fetchedAt
    return NextResponse.json({
      ok: true,
      fetchedAt,
      anchorUsed,
      freshness: {
        ...freshness,
        fetchedAt,
        anchorUsed,
      },
      validation: result.validation,
      gameCount: result.gameCount,
      sourceUsed: result.sourceUsed,
      fallbackUsed: result.fallbackUsed,
      ...(includeGames ? { games: getEngineGames() } : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[GamePlan] Operational schedule refresh failed.", e)
    return NextResponse.json(
      {
        ok: false,
        error: message,
        freshness: getDataFreshness(),
        validation: getLastScheduleValidation(),
        gameCount: getEngineGames().length,
      },
      { status: 500 }
    )
  }
}
