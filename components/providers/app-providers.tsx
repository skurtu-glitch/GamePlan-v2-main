"use client"

import type { ReactNode } from "react"
import { DemoUserProvider } from "@/components/providers/demo-user-provider"
import { PromotionsProvider } from "@/components/providers/promotions-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <DemoUserProvider>
      <PromotionsProvider>{children}</PromotionsProvider>
    </DemoUserProvider>
  )
}
