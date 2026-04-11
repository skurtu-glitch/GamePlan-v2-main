"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import {
  isSetupDeferred,
  isSetupPrompted,
  setSetupPrompted,
} from "@/lib/setup-session"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

const GP_SETUP_BANNER_DISMISSED_KEY = "gp_setup_banner_dismissed"

function pathAllowsSoftGate(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname === "/setup" || pathname.startsWith("/setup/")) return false
  if (pathname.startsWith("/auth")) return false
  return true
}

/**
 * Non-blocking setup guidance: one auto-redirect to `/setup` per session (any entry route);
 * defer skips further redirects; dismiss hides the banner for the session until setup completes.
 */
export function SetupSoftGate() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, hydrated, remoteReady } = useDemoUser()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (sessionStorage.getItem(GP_SETUP_BANNER_DISMISSED_KEY) === "true") {
        setBannerDismissed(true)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!state.hasCompletedSetup) return
    if (typeof window === "undefined") return
    try {
      sessionStorage.removeItem(GP_SETUP_BANNER_DISMISSED_KEY)
    } catch {
      // ignore
    }
    setBannerDismissed(false)
  }, [state.hasCompletedSetup])

  useEffect(() => {
    if (!hydrated || !remoteReady) return
    if (state.hasCompletedSetup) return

    if (pathname === "/setup" || pathname?.startsWith("/setup/")) {
      if (!isSetupPrompted()) setSetupPrompted()
      return
    }

    if (!pathAllowsSoftGate(pathname)) return
    if (isSetupDeferred()) return
    if (isSetupPrompted()) return
    setSetupPrompted()
    router.replace("/setup")
  }, [hydrated, remoteReady, pathname, router, state.hasCompletedSetup])

  if (!hydrated || !remoteReady) return null
  if (!pathAllowsSoftGate(pathname)) return null
  if (state.hasCompletedSetup) return null
  if (bannerDismissed) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex w-full max-w-lg items-center gap-2 rounded-lg border border-accent/40 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-md">
        <p className="min-w-0 flex-1 text-xs font-medium leading-snug text-foreground">
          Finish quick setup to personalize teams, location, and preferences.
        </p>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/setup">Continue setup</Link>
        </Button>
        <button
          type="button"
          aria-label="Dismiss setup reminder"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={() => {
            try {
              sessionStorage.setItem(GP_SETUP_BANNER_DISMISSED_KEY, "true")
            } catch {
              // ignore
            }
            setBannerDismissed(true)
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
