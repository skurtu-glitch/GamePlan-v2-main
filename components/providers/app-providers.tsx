"use client"

import type { ReactNode } from "react"
import { DemoUserProvider } from "@/components/providers/demo-user-provider"
import { PromotionsProvider } from "@/components/providers/promotions-provider"
import { SupabaseAuthProvider } from "@/components/providers/supabase-auth-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <DemoUserProvider>
        <PromotionsProvider>{children}</PromotionsProvider>
      </DemoUserProvider>
    </SupabaseAuthProvider>
  )
}
