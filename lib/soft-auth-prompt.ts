const IMPRESSIONS_KEY = "gp_soft_auth_prompt_impressions"
/** Max auto-shows per browser session (any surface) to avoid spam. */
export const SOFT_AUTH_PROMPT_MAX_IMPRESSIONS = 3

export const GP_SETUP_JUST_FINISHED_KEY = "gp_setup_just_finished"
export const GP_SOFT_AUTH_MOMENT_KEY = "gp_soft_auth_moment"

export type SoftAuthPromptSurface =
  | "setup_complete"
  | "teams_edit"
  | "services_edit"
  | "coverage"
  | "plans"

export type SoftAuthNavMoment = "coverage" | "plans"

function ssSet(key: string, value: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function ssGet(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function ssRemove(key: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function dismissKey(surface: SoftAuthPromptSurface): string {
  return `gp_soft_auth_dismiss_${surface}`
}

export function isSoftAuthPromptDismissed(surface: SoftAuthPromptSurface): boolean {
  return ssGet(dismissKey(surface)) === "1"
}

export function dismissSoftAuthPrompt(surface: SoftAuthPromptSurface): void {
  ssSet(dismissKey(surface), "1")
}

function readImpressions(): number {
  const raw = ssGet(IMPRESSIONS_KEY)
  const n = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Reserve a session slot before showing a prompt; returns false when cap reached. */
export function tryBeginSoftAuthPrompt(): boolean {
  const n = readImpressions()
  if (n >= SOFT_AUTH_PROMPT_MAX_IMPRESSIONS) return false
  ssSet(IMPRESSIONS_KEY, String(n + 1))
  return true
}

export function markSoftAuthSetupCompleteHomePending(): void {
  ssSet(GP_SETUP_JUST_FINISHED_KEY, "1")
}

export function consumeSoftAuthSetupCompleteHomePending(): boolean {
  if (ssGet(GP_SETUP_JUST_FINISHED_KEY) !== "1") return false
  ssRemove(GP_SETUP_JUST_FINISHED_KEY)
  return true
}

export function setSoftAuthNavMoment(moment: SoftAuthNavMoment): void {
  ssSet(GP_SOFT_AUTH_MOMENT_KEY, moment)
}

export function peekSoftAuthNavMoment(): SoftAuthNavMoment | null {
  const v = ssGet(GP_SOFT_AUTH_MOMENT_KEY)
  if (v === "coverage" || v === "plans") return v
  return null
}

export function consumeSoftAuthNavMoment(expected: SoftAuthNavMoment): boolean {
  if (peekSoftAuthNavMoment() !== expected) return false
  ssRemove(GP_SOFT_AUTH_MOMENT_KEY)
  return true
}

export function consumeSoftAuthNavMomentIf(expected: SoftAuthNavMoment): boolean {
  return consumeSoftAuthNavMoment(expected)
}
