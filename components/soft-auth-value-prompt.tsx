"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useSupabaseAuth } from "@/components/providers/supabase-auth-provider"
import {
  dismissSoftAuthPrompt,
  isSoftAuthPromptDismissed,
  tryBeginSoftAuthPrompt,
  type SoftAuthPromptSurface,
} from "@/lib/soft-auth-prompt"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const HOME_SIGNIN_NEXT = encodeURIComponent("/")

type SoftAuthValuePromptProps = {
  surface: SoftAuthPromptSurface
  when: boolean
  className?: string
  onDismissed?: () => void
}

/**
 * Dismissible upsell for account sync after value moments. Does not block navigation.
 */
export function SoftAuthValuePrompt({
  surface,
  when,
  className,
  onDismissed,
}: SoftAuthValuePromptProps) {
  const { user, ready, supabaseConfigured } = useSupabaseAuth()
  const signedIn = Boolean(user)
  const [open, setOpen] = useState(false)
  const reservedRef = useRef(false)

  useEffect(() => {
    if (!when || !ready || signedIn || !supabaseConfigured) return
    if (isSoftAuthPromptDismissed(surface)) return
    if (reservedRef.current) return
    if (!tryBeginSoftAuthPrompt()) return
    reservedRef.current = true
    setOpen(true)
  }, [when, ready, signedIn, supabaseConfigured, surface])

  if (!open) return null

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 shadow-sm",
        className
      )}
      role="status"
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="text-xs font-semibold text-foreground">Save your setup</p>
        <p className="text-[11px] text-muted-foreground">Sync across devices.</p>
        <Link
          href={`/auth/sign-in?next=${HOME_SIGNIN_NEXT}`}
          className="mt-1 inline-block text-[11px] font-medium text-accent underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        onClick={() => {
          dismissSoftAuthPrompt(surface)
          onDismissed?.()
          setOpen(false)
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
