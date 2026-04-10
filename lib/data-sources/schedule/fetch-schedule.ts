/**
 * Async schedule ingestion: remote URL (optional) or committed default ingest file.
 * Pair with `lib/data-cache.ts` for TTL. Synchronous app boot uses `ingest-default.json` directly.
 */

import type { ScheduleIngestPayload } from "@/lib/data-sources/schedule/types"
import { validateScheduleIngest } from "@/lib/data-validation/validate-schedule-ingest"
import defaultIngest from "@/lib/data-sources/schedule/ingest-default.json"
import { getOrFetchRemoteScheduleJson } from "@/lib/data-cache"
export interface ScheduleFetchResult {
  payload: ScheduleIngestPayload
  /** Where this JSON came from (URL or file label). */
  sourceName: string
  /** When this function resolved. */
  fetchedAt: string
  /** Structured validation outcome for the resolved payload. */
  validationErrors?: import("@/lib/data-validation/validate-schedule-ingest").ScheduleValidationError[]
}

function assertValid(
  raw: unknown,
  label: string,
  allowedTeamIds: readonly string[]
): { ok: true; payload: ScheduleIngestPayload } | { ok: false; errors: ScheduleFetchResult["validationErrors"] } {
  const v = validateScheduleIngest(raw, { allowedTeamIds })
  if (!v.ok) {
    console.warn(`[GamePlan] Schedule validation failed (${label})`, v.errors)
    return { ok: false, errors: v.errors }
  }
  return { ok: true, payload: v.payload }
}

/**
 * Fetch + validate ingest payload. Uses `GAMEPLAN_SCHEDULE_SOURCE_URL` when set; otherwise default file.
 * Invalid payloads throw so callers (e.g. previews) fail loudly instead of composing bad engine rows.
 */
export async function fetchScheduleRaw(options: {
  allowedTeamIds: readonly string[]
  force?: boolean
}): Promise<ScheduleFetchResult> {
  const force = options.force ?? false
  const allowedTeamIds = options.allowedTeamIds
  const url =
    typeof process !== "undefined" ? process.env.GAMEPLAN_SCHEDULE_SOURCE_URL?.trim() : ""

  if (url) {
    const raw = await getOrFetchRemoteScheduleJson(url, force)
    const v = assertValid(raw, "remote", allowedTeamIds)
    if (!v.ok) {
      throw new Error(
        `[GamePlan] Remote schedule validation failed: ${v.errors?.map((e) => e.message).join("; ")}`
      )
    }
    return {
      payload: v.payload,
      sourceName: url,
      fetchedAt: new Date().toISOString(),
    }
  }

  const v = assertValid(defaultIngest as unknown, "committed-default", allowedTeamIds)
  if (!v.ok) {
    throw new Error(
      `[GamePlan] Committed schedule validation failed: ${v.errors?.map((e) => e.message).join("; ")}`
    )
  }
  return {
    payload: v.payload,
    sourceName: (defaultIngest as { _meta: { sourceName: string } })._meta.sourceName,
    fetchedAt: new Date().toISOString(),
  }
}
