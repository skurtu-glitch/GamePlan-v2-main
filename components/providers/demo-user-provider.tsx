"use client"

/**
 * Profile load / seed rules (MVP, no merge UI):
 *
 * 1. **Hydrate** — On mount, read `localStorage` into React state (device cache for signed-out / demo).
 * 2. **Signed out** — State is the source of truth; every change is written back to `localStorage`.
 * 3. **Signed in + Supabase** — After auth is ready, `fetchProfileForUser`:
 *    - Row with `__gp_saved: true` in `payload` → **cloud wins**; replace in-memory state.
 *    - No row or row without marker (e.g. `{}`) → **seed cloud once** from current in-memory
 *      state (already hydrated from local), then upsert.
 * 4. **Persistence while signed in** — Debounced upserts to `profiles`; **no** GamePlan mirror to
 *    `localStorage` (DB is source of truth). On **sign-out**, the latest state is flushed to
 *    `localStorage` once so the device keeps a sensible offline copy.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  DEMO_USER_STORAGE_KEY,
  DEMO_USER_STORAGE_KEY_LEGACY,
  defaultDemoUserState,
  mergeDemoUserState,
  withSyncedSubscriptionFields,
  type DemoUserState,
} from "@/lib/demo-user"
import {
  fetchProfileForUser,
  upsertProfileForUser,
  upsertProfileForUserWithResult,
} from "@/lib/persistence/supabase-profile"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useSupabaseAuth } from "@/components/providers/supabase-auth-provider"

export type PersistenceMode = "local" | "cloud"
export type CloudSyncStatus = "idle" | "syncing" | "saved" | "error"

type DemoUserContextValue = {
  state: DemoUserState
  setDemoUserState: (update: DemoUserState | ((prev: DemoUserState) => DemoUserState)) => void
  toggleConnectedService: (id: string) => void
  /** True after localStorage has been read (or attempted). */
  hydrated: boolean
  /** True after remote profile load attempt finished for the current auth user (or skipped). */
  remoteReady: boolean
  /** `local` = this device only; `cloud` = signed in with Supabase profile sync. */
  persistenceMode: PersistenceMode
  /** Meaningful when `persistenceMode === "cloud"` after first remote sync. */
  cloudSyncStatus: CloudSyncStatus
}

const DemoUserContext = createContext<DemoUserContextValue | null>(null)

function readStoredDemoUser(): DemoUserState | null {
  if (typeof window === "undefined") return null
  try {
    const raw =
      localStorage.getItem(DEMO_USER_STORAGE_KEY) ??
      localStorage.getItem(DEMO_USER_STORAGE_KEY_LEGACY)
    if (!raw) return null
    return mergeDemoUserState(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

function persistDemoUser(state: DemoUserState): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(state))
    localStorage.removeItem(DEMO_USER_STORAGE_KEY_LEGACY)
  } catch {
    // ignore quota / private mode
  }
}

function isCloudSessionActive(userId: string | undefined): boolean {
  return Boolean(userId && getSupabaseBrowserClient())
}

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useSupabaseAuth()
  const [state, setState] = useState<DemoUserState>(() =>
    withSyncedSubscriptionFields(defaultDemoUserState)
  )
  const [hydrated, setHydrated] = useState(false)
  const [remoteReady, setRemoteReady] = useState(false)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("idle")

  const stateRef = useRef(state)
  stateRef.current = state

  const prevAuthUid = useRef<string | null>(null)

  useEffect(() => {
    const stored = readStoredDemoUser()
    if (stored) setState(stored)
    setHydrated(true)
  }, [])

  /** Flush latest state to device when leaving a signed-in session (offline / demo copy). */
  useEffect(() => {
    const uid = user?.id ?? null
    if (prevAuthUid.current && !uid && hydrated) {
      persistDemoUser(stateRef.current)
    }
    prevAuthUid.current = uid
  }, [user?.id, hydrated])

  /** Load or seed remote profile when a session appears. */
  useEffect(() => {
    if (!hydrated || !authReady) return

    const supabase = getSupabaseBrowserClient()
    const uid = user?.id ?? null

    if (!supabase || !uid) {
      setRemoteReady(true)
      setCloudSyncStatus("idle")
      return
    }

    setRemoteReady(false)
    setCloudSyncStatus("idle")
    let cancelled = false
    ;(async () => {
      const remote = await fetchProfileForUser(supabase, uid)
      if (cancelled) return
      if (remote) {
        setState(withSyncedSubscriptionFields(remote))
      } else {
        setState((prev) => {
          const next = withSyncedSubscriptionFields(prev)
          void upsertProfileForUser(supabase, uid, next)
          return next
        })
      }
      if (!cancelled) setRemoteReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [hydrated, authReady, user?.id])

  /** Signed-out (or Supabase off): mirror to localStorage. Signed-in + Supabase: skip (cloud is canonical). */
  useEffect(() => {
    if (!hydrated) return
    if (isCloudSessionActive(user?.id)) return
    persistDemoUser(state)
  }, [state, hydrated, user?.id])

  useEffect(() => {
    if (!hydrated || !remoteReady) return
    const supabase = getSupabaseBrowserClient()
    const uid = user?.id
    if (!supabase || !uid) return

    /**
     * Browser timer ids are numeric. With `@types/node`, `ReturnType<typeof setTimeout>` is
     * `NodeJS.Timeout`, so we use `number` here to match `window.setTimeout` / `clearTimeout`.
     */
    type BrowserTimerId = number
    let savedClear: BrowserTimerId | undefined
    setCloudSyncStatus("syncing")

    const t: BrowserTimerId = window.setTimeout(() => {
      void upsertProfileForUserWithResult(supabase, uid, state).then((r) => {
        if (r.ok) {
          setCloudSyncStatus("saved")
          savedClear = window.setTimeout(() => setCloudSyncStatus("idle"), 2800)
        } else {
          setCloudSyncStatus("error")
          savedClear = window.setTimeout(() => setCloudSyncStatus("idle"), 4000)
        }
      })
    }, 600)

    return () => {
      clearTimeout(t)
      if (savedClear) clearTimeout(savedClear)
    }
  }, [state, hydrated, remoteReady, user?.id])

  const setDemoUserState = useCallback(
    (update: DemoUserState | ((prev: DemoUserState) => DemoUserState)) => {
      setState((prev) => {
        const next = typeof update === "function" ? update(prev) : update
        return withSyncedSubscriptionFields(next)
      })
    },
    []
  )

  const toggleConnectedService = useCallback((id: string) => {
    setState((prev) => {
      const synced = withSyncedSubscriptionFields(prev)
      const has = synced.subscriptions.some((s) => s.serviceId === id)
      const subscriptions = has
        ? synced.subscriptions.filter((s) => s.serviceId !== id)
        : [...synced.subscriptions, { serviceId: id }]
      return withSyncedSubscriptionFields({ ...synced, subscriptions, connectedServiceIds: [] })
    })
  }, [])

  const persistenceMode: PersistenceMode = isCloudSessionActive(user?.id) ? "cloud" : "local"

  const value = useMemo<DemoUserContextValue>(
    () => ({
      state,
      setDemoUserState,
      toggleConnectedService,
      hydrated,
      remoteReady,
      persistenceMode,
      cloudSyncStatus: persistenceMode === "cloud" ? cloudSyncStatus : "idle",
    }),
    [
      state,
      setDemoUserState,
      toggleConnectedService,
      hydrated,
      remoteReady,
      persistenceMode,
      cloudSyncStatus,
    ]
  )

  return <DemoUserContext.Provider value={value}>{children}</DemoUserContext.Provider>
}

export function useDemoUser(): DemoUserContextValue {
  const ctx = useContext(DemoUserContext)
  if (!ctx) throw new Error("useDemoUser must be used within DemoUserProvider")
  return ctx
}
