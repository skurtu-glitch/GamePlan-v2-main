"use client"

import type { ReactNode } from "react"
import { DemoUserProvider } from "@/components/providers/demo-user-provider"
import { PromotionsProvider } from "@/components/providers/promotions-provider"
import { ScheduleProvider } from "@/components/providers/schedule-provider"
import { SupabaseAuthProvider } from "@/components/providers/supabase-auth-provider"
import { SetupSoftGate } from "@/components/setup-soft-gate"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SupabaseAuthProvider>
      <ScheduleProvider>
        <DemoUserProvider>
          <PromotionsProvider>
            <SetupSoftGate />
            {children}
          </PromotionsProvider>
        </DemoUserProvider>
      </ScheduleProvider>
    </SupabaseAuthProvider>
  )
}
