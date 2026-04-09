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
import {
  DEMO_USER_STORAGE_KEY,
  DEMO_USER_STORAGE_KEY_LEGACY,
  defaultDemoUserState,
  mergeDemoUserState,
  withSyncedSubscriptionFields,
  type DemoUserState,
} from "@/lib/demo-user"

type DemoUserContextValue = {
  state: DemoUserState
  setDemoUserState: (update: DemoUserState | ((prev: DemoUserState) => DemoUserState)) => void
  toggleConnectedService: (id: string) => void
  /** True after localStorage has been read (or attempted). */
  hydrated: boolean
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

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoUserState>(() =>
    withSyncedSubscriptionFields(defaultDemoUserState)
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readStoredDemoUser()
    if (stored) setState(stored)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    persistDemoUser(state)
  }, [state, hydrated])

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

  const value = useMemo<DemoUserContextValue>(
    () => ({
      state,
      setDemoUserState,
      toggleConnectedService,
      hydrated,
    }),
    [state, setDemoUserState, toggleConnectedService, hydrated]
  )

  return <DemoUserContext.Provider value={value}>{children}</DemoUserContext.Provider>
}

export function useDemoUser(): DemoUserContextValue {
  const ctx = useContext(DemoUserContext)
  if (!ctx) throw new Error("useDemoUser must be used within DemoUserProvider")
  return ctx
}
