"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect } from "react"
import { fetchPromotions } from "@/lib/promotions-fetch.client"

export function PromotionsProvider({ children }: { children: ReactNode }) {
  const load = useCallback(async () => {
    await fetchPromotions()
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return <>{children}</>
}

export function useReloadPromotionsCatalog() {
  return useCallback(async () => {
    await fetchPromotions()
  }, [])
}
