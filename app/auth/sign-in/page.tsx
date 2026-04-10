"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSupabaseAuth } from "@/components/providers/supabase-auth-provider"
import { ArrowLeft } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const { signInWithPassword, supabaseConfigured } = useSupabaseAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: err } = await signInWithPassword(email.trim(), password)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    router.replace("/settings")
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <Link
            href="/settings"
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sign in</h1>
            <p className="text-xs text-muted-foreground">Sync your GamePlan setup</p>
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
                autoComplete="current-password"
                required
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
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !supabaseConfigured}
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              New here? Create an account in the{" "}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                Supabase dashboard
              </a>{" "}
              (Auth → Users) or enable email sign-ups, then return to sign in.
            </p>
          </form>
        </Card>
      </main>

      <BottomNav />
    </div>
  )
}
