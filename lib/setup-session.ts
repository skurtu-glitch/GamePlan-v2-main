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

/**
 * After auth from setup, prefer the in-memory profile over an existing cloud row once,
 * and upsert so the current setup is saved to `profiles`.
 */
export const GP_SETUP_CLOUD_PUSH_LOCAL_KEY = "gp_setup_cloud_push_local"

export function setSetupCloudPushLocalIntent(): void {
  setSessionFlag(GP_SETUP_CLOUD_PUSH_LOCAL_KEY, "1")
}

/** Returns true once (clears the flag). */
export function consumeSetupCloudPushLocalIntent(): boolean {
  if (typeof window === "undefined") return false
  try {
    if (sessionStorage.getItem(GP_SETUP_CLOUD_PUSH_LOCAL_KEY) !== "1") return false
    sessionStorage.removeItem(GP_SETUP_CLOUD_PUSH_LOCAL_KEY)
    return true
  } catch {
    return false
  }
}

export function clearSetupCloudPushLocalIntent(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(GP_SETUP_CLOUD_PUSH_LOCAL_KEY)
  } catch {
    // ignore
  }
}
