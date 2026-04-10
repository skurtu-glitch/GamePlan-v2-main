/**
 * Last-known-good schedule snapshot on disk (Node server only — import only from server routes / instrumentation).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import type { ScheduleIngestPayload } from "./types"

export const SCHEDULE_LKG_VERSION = 1 as const

export interface ScheduleLkgEnvelope {
  version: typeof SCHEDULE_LKG_VERSION
  savedAt: string
  /** Where the validated payload originated (e.g. remote URL). */
  effectiveSourceName: string
  payload: ScheduleIngestPayload
}

export function scheduleLkgFilePath(): string {
  const env = typeof process !== "undefined" ? process.env.GAMEPLAN_SCHEDULE_LKG_PATH?.trim() : ""
  if (env) return env
  return join(/* turbopackIgnore: true */ process.cwd(), ".gameplan", "schedule-lkg.json")
}

export function readScheduleLkgEnvelope(): ScheduleLkgEnvelope | null {
  try {
    const p = scheduleLkgFilePath()
    if (!existsSync(p)) return null
    const raw = JSON.parse(readFileSync(p, "utf8")) as ScheduleLkgEnvelope
    if (
      raw?.version !== SCHEDULE_LKG_VERSION ||
      !raw.payload ||
      typeof raw.savedAt !== "string" ||
      typeof raw.effectiveSourceName !== "string"
    ) {
      return null
    }
    return raw
  } catch {
    return null
  }
}

export function writeScheduleLkgEnvelope(envelope: ScheduleLkgEnvelope): void {
  const p = scheduleLkgFilePath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(envelope, null, 2), "utf8")
}
