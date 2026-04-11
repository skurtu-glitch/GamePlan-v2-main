/** User chose “Browse without setup”; skip auto-redirect for this session only. */
export const GP_SETUP_DEFERRED_KEY = "gp_setup_deferred"

/** Auto-redirect to `/setup` has already run once this session. */
export const GP_SETUP_PROMPTED_KEY = "gp_setup_prompted"

function setSessionFlag(key: string, value: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function sessionFlagIs(key: string, value: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(key) === value
  } catch {
    return false
  }
}

export function setSetupDeferred(): void {
  setSessionFlag(GP_SETUP_DEFERRED_KEY, "1")
}

export function isSetupDeferred(): boolean {
  return sessionFlagIs(GP_SETUP_DEFERRED_KEY, "1")
}

export function setSetupPrompted(): void {
  setSessionFlag(GP_SETUP_PROMPTED_KEY, "1")
}

export function isSetupPrompted(): boolean {
  return sessionFlagIs(GP_SETUP_PROMPTED_KEY, "1")
}
