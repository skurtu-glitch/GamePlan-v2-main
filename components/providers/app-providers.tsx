"use client"

import type { ReactNode } from "react"
import { DemoUserProvider } from "@/components/providers/demo-user-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return <DemoUserProvider>{children}</DemoUserProvider>
}
