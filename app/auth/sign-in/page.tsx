"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSupabaseAuth } from "@/components/providers/supabase-auth-provider"
import { clearSetupCloudPushLocalIntent, setSetupCloudPushLocalIntent } from "@/lib/setup-session"
import { ArrowLeft } from "lucide-react"

function readNextPath(): string {
  if (typeof window === "undefined") return "/settings"
  const raw = new URLSearchParams(window.location.search).get("next")
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw
  return "/settings"
}

function readRegisterMode(): boolean {
  if (typeof window === "undefined") return false
  const v = new URLSearchParams(window.location.search).get("register")
  return v === "1" || v === "true"
}

export default function SignInPage() {
  const router = useRouter()
  const { signInWithPassword, signUpWithPassword, supabaseConfigured } = useSupabaseAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [createMode, setCreateMode] = useState(false)
  const [backHref, setBackHref] = useState("/settings")
  const [fromSetup, setFromSetup] = useState(false)
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false)

  useEffect(() => {
    const next = readNextPath()
    setFromSetup(next.includes("setup"))
    setBackHref(next.includes("setup") ? "/setup" : "/settings")
    setCreateMode(readRegisterMode())
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPendingEmailConfirm(false)
    setBusy(true)
    const next = readNextPath()
    if (next.includes("setup")) {
      setSetupCloudPushLocalIntent()
    }

    if (createMode) {
      const { error: err, sessionCreated } = await signUpWithPassword(email.trim(), password)
      setBusy(false)
      if (err) {
        clearSetupCloudPushLocalIntent()
        setError(err)
        return
      }
      if (sessionCreated) {
        router.replace(next)
        return
      }
      clearSetupCloudPushLocalIntent()
      setPendingEmailConfirm(true)
      return
    }

    const { error: err } = await signInWithPassword(email.trim(), password)
    setBusy(false)
    if (err) {
      clearSetupCloudPushLocalIntent()
      setError(err)
      return
    }
    router.replace(next)
  }

  const heading = createMode ? "Create account" : "Sign in"
  const sub = fromSetup
    ? "Save your setup and access it from any device."
    : createMode
      ? "Create your GamePlan account."
      : "Sync your GamePlan setup"

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <Link
            href={backHref}
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">{heading}</h1>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {!supabaseConfigured && (
          <Card className="mb-4 border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm text-foreground">
              Supabase is not configured. Add{" "}
              <code className="rounded bg-secondary px-1 text-xs">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-secondary px-1 text-xs">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>{" "}
              to your environment, then restart the dev server.
            </p>
          </Card>
        )}

        <Card className="overflow-hidden border-border p-0">
          <form onSubmit={onSubmit} className="space-y-4 p-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={createMode ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            {pendingEmailConfirm && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Check your email to confirm your account. After confirming, sign in here—your setup
                on this device stays until you sign in.
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !supabaseConfigured}
            >
              {busy
                ? createMode
                  ? "Creating…"
                  : "Signing in…"
                : createMode
                  ? "Create account"
                  : "Sign in"}
            </Button>
            <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
              <button
                type="button"
                className="text-center text-sm font-medium text-accent underline-offset-2 hover:underline"
                onClick={() => {
                  setCreateMode((c) => !c)
                  setError(null)
                  setPendingEmailConfirm(false)
                }}
              >
                {createMode ? "Already have an account? Sign in" : "Need an account? Create one"}
              </button>
            </div>
          </form>
        </Card>
      </main>

      <BottomNav />
    </div>
  )
}
