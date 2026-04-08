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
  defaultDemoUserState,
  mergeDemoUserState,
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

export function DemoUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoUserState>(defaultDemoUserState)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEMO_USER_STORAGE_KEY)
      if (raw) setState(mergeDemoUserState(JSON.parse(raw) as unknown))
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore quota / private mode
    }
  }, [state, hydrated])

  const setDemoUserState = useCallback(
    (update: DemoUserState | ((prev: DemoUserState) => DemoUserState)) => {
      setState((prev) => (typeof update === "function" ? update(prev) : update))
    },
    []
  )

  const toggleConnectedService = useCallback((id: string) => {
    setState((prev) => {
      const has = prev.connectedServiceIds.includes(id)
      return {
        ...prev,
        connectedServiceIds: has
          ? prev.connectedServiceIds.filter((s) => s !== id)
          : [...prev.connectedServiceIds, id],
      }
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
