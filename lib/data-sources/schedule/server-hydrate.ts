/**
 * Server-only schedule resolution: remote → last-known-good → committed ingest → static demo.
 * Updates the shared in-memory engine via {@link applyEngineScheduleFromPipeline}.
 */

import type { Team } from "@/lib/types"
import { composeEngineGamesFromNormalized } from "@/lib/data-normalization/compose-engine-games"
import { normalizeScheduleIngest } from "@/lib/data-normalization/normalize-schedule"
import type {
  ScheduleValidationError,
  ScheduleValidationResult,
} from "@/lib/data-validation/validate-schedule-ingest"
import { validateScheduleIngest } from "@/lib/data-validation/validate-schedule-ingest"
import {
  applyEngineScheduleFromPipeline,
  buildFreshnessForPayload,
  buildStaticDemoEngineGames,
  type ScheduleSourceUsed,
  type ScheduleValidationSummary,
} from "@/lib/data-sources/games"
import { getOrFetchRemoteScheduleJson, invalidateRemoteScheduleCache } from "@/lib/data-cache"
import defaultIngest from "@/lib/data-sources/schedule/ingest-default.json"
import type { ScheduleIngestPayload } from "@/lib/data-sources/schedule/types"
import {
  readScheduleLkgEnvelope,
  writeScheduleLkgEnvelope,
  type ScheduleLkgEnvelope,
} from "@/lib/data-sources/schedule/lkg-store"

declare global {
  // eslint-disable-next-line no-var
  var __gameplanServerScheduleHydrated: boolean | undefined
}

function hydrationFlag(): boolean {
  return globalThis.__gameplanServerScheduleHydrated === true
}

function setHydrationFlag(): void {
  globalThis.__gameplanServerScheduleHydrated = true
}

function teamCtx(teams: Team[]) {
  return {
    teamById: new Map(teams.map((t) => [t.id, t])),
    teamIds: teams.map((t) => t.id),
    teamLeagueById: new Map(teams.map((t) => [t.id, t.league])),
  }
}

function validationOk(checkedAt: string): ScheduleValidationSummary {
  return { status: "ok", checkedAt }
}

function validationErr(
  checkedAt: string,
  errors: ScheduleValidationError[] | undefined
): ScheduleValidationSummary {
  return { status: "error", checkedAt, errors }
}

function applyFromPayload(
  payload: ScheduleIngestPayload,
  teams: Team[],
  sourceUsed: ScheduleSourceUsed,
  fallbackUsed: boolean,
  validation: ScheduleValidationSummary,
  lastKnownGoodSavedAt: string | undefined,
  anchor: Date
): number {
  const { teamById } = teamCtx(teams)
  const normalized = normalizeScheduleIngest(payload, anchor, teamById)
  const games = composeEngineGamesFromNormalized(normalized, teamById)
  applyEngineScheduleFromPipeline(
    games,
    buildFreshnessForPayload(payload, sourceUsed, fallbackUsed, lastKnownGoodSavedAt),
    validation
  )
  return games.length
}

async function fetchRemotePayload(
  url: string,
  teams: Team[],
  force: boolean
): Promise<
  | { ok: true; payload: ScheduleIngestPayload; url: string }
  | { ok: false; errors: ScheduleValidationError[] }
> {
  const { teamIds, teamLeagueById } = teamCtx(teams)
  try {
    const raw = await getOrFetchRemoteScheduleJson(url, force)
    const v = validateScheduleIngest(raw, { allowedTeamIds: teamIds, teamLeagueById })
    if (!v.ok) return { ok: false, errors: v.errors }
    return { ok: true, payload: v.payload, url }
  } catch (e) {
    return {
      ok: false,
      errors: [
        {
          code: "remote_fetch",
          path: "remote",
          message: e instanceof Error ? e.message : String(e),
        },
      ],
    }
  }
}

function loadCommitted(teams: Team[]): ScheduleValidationResult {
  const { teamIds, teamLeagueById } = teamCtx(teams)
  return validateScheduleIngest(defaultIngest as unknown, {
    allowedTeamIds: teamIds,
    teamLeagueById,
  })
}

/** Validated last-known-good envelope + payload, or `null` when missing or invalid. */
type LastKnownGoodScheduleLoad = {
  envelope: ScheduleLkgEnvelope
  payload: ScheduleIngestPayload
}

function loadLkg(teams: Team[]): LastKnownGoodScheduleLoad | null {
  const env = readScheduleLkgEnvelope()
  if (!env) return null
  const { teamIds, teamLeagueById } = teamCtx(teams)
  const v = validateScheduleIngest(env.payload as unknown, {
    allowedTeamIds: teamIds,
    teamLeagueById,
  })
  if (!v.ok) return null
  return { envelope: env, payload: v.payload }
}

export interface ServerHydrationResult {
  sourceUsed: ScheduleSourceUsed
  fallbackUsed: boolean
  validation: ScheduleValidationSummary
  gameCount: number
}

/**
 * Production resolution order when remote URL is configured:
 * 1) remote (fetch + valid)
 * 2) last-known-good file (valid)
 * 3) committed ingest-default.json (valid)
 * 4) static demo rows
 *
 * Without remote URL: (2) → (3) → (4).
 */
export async function resolveAndApplyServerSchedule(
  teams: Team[],
  options?: { forceRemote?: boolean }
): Promise<ServerHydrationResult> {
  const anchor = new Date()
  const checkedAt = anchor.toISOString()
  const force = options?.forceRemote ?? false

  const remoteUrl =
    typeof process !== "undefined" ? process.env.GAMEPLAN_SCHEDULE_SOURCE_URL?.trim() ?? "" : ""

  let remoteErrors: ScheduleValidationError[] | undefined
  let attemptedRemote = false

  if (remoteUrl) {
    attemptedRemote = true
    const remote = await fetchRemotePayload(remoteUrl, teams, force)
    if (remote.ok) {
      const envelope: ScheduleLkgEnvelope = {
        version: 1,
        savedAt: checkedAt,
        effectiveSourceName: remote.url,
        payload: remote.payload,
      }
      try {
        writeScheduleLkgEnvelope(envelope)
      } catch (e) {
        console.warn("[GamePlan] Could not persist schedule LKG file.", e)
      }
      const gc = applyFromPayload(
        remote.payload,
        teams,
        "remote",
        false,
        validationOk(checkedAt),
        undefined,
        anchor
      )
      return {
        sourceUsed: "remote",
        fallbackUsed: false,
        validation: validationOk(checkedAt),
        gameCount: gc,
      }
    }
    remoteErrors = remote.errors
  }

  const diagValidation = (): ScheduleValidationSummary =>
    attemptedRemote && remoteErrors?.length
      ? validationErr(checkedAt, remoteErrors)
      : validationOk(checkedAt)

  const lkg = loadLkg(teams)
  if (lkg) {
    const gc = applyFromPayload(
      lkg.payload,
      teams,
      "last-known-good",
      attemptedRemote,
      diagValidation(),
      lkg.envelope.savedAt,
      anchor
    )
    return {
      sourceUsed: "last-known-good",
      fallbackUsed: attemptedRemote,
      validation: diagValidation(),
      gameCount: gc,
    }
  }

  const committed = loadCommitted(teams)
  if (committed.ok) {
    const gc = applyFromPayload(
      committed.payload,
      teams,
      "committed-ingest",
      attemptedRemote,
      diagValidation(),
      undefined,
      anchor
    )
    return {
      sourceUsed: "committed-ingest",
      fallbackUsed: attemptedRemote,
      validation: diagValidation(),
      gameCount: gc,
    }
  }

  const staticGames = buildStaticDemoEngineGames(teams, anchor)
  applyEngineScheduleFromPipeline(
    staticGames,
    {
      lastUpdated: checkedAt,
      sourceName: "static-demo-fallback",
      isStale: false,
      sourceUsed: "static-demo-fallback",
      fallbackUsed: true,
    },
    validationErr(checkedAt, committed.ok === false ? committed.errors : remoteErrors)
  )
  return {
    sourceUsed: "static-demo-fallback",
    fallbackUsed: true,
    validation: validationErr(
      checkedAt,
      committed.ok === false ? committed.errors : remoteErrors
    ),
    gameCount: staticGames.length,
  }
}

/** One-time server boot / lazy GET hydration. */
export async function ensureServerScheduleHydrated(teams: Team[]): Promise<ServerHydrationResult | null> {
  if (hydrationFlag()) return null
  const result = await resolveAndApplyServerSchedule(teams, { forceRemote: false })
  setHydrationFlag()
  return result
}

export async function runOperationalScheduleRefresh(
  teams: Team[],
  options?: { force?: boolean }
): Promise<ServerHydrationResult> {
  if (options?.force) invalidateRemoteScheduleCache()
  const result = await resolveAndApplyServerSchedule(teams, { forceRemote: Boolean(options?.force) })
  setHydrationFlag()
  return result
}
