"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SetupTeamsStep } from "@/components/setup-teams-step"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import { useSupabaseAuth } from "@/components/providers/supabase-auth-provider"
import { markSoftAuthSetupCompleteHomePending } from "@/lib/soft-auth-prompt"
import { setSetupDeferred } from "@/lib/setup-session"
import type { League } from "@/lib/types"
import { Check, ChevronLeft, Cloud, Sparkles } from "lucide-react"

const SETUP_ACCOUNT_AUTH_NEXT = encodeURIComponent("/setup?s=account")

type SetupStep = "welcome" | "teams" | "location" | "preferences" | "account" | "finish"

const STEP_ORDER: SetupStep[] = [
  "welcome",
  "teams",
  "location",
  "preferences",
  "account",
  "finish",
]

function stepIndex(s: SetupStep): number {
  return STEP_ORDER.indexOf(s)
}

export default function SetupPage() {
  const router = useRouter()
  const { state, setDemoUserState } = useDemoUser()
  const { user, supabaseConfigured, ready: authReady } = useSupabaseAuth()
  const [step, setStep] = useState<SetupStep>("welcome")
  const [stepHydratedFromUrl, setStepHydratedFromUrl] = useState(false)
  const [setupTeamLeague, setSetupTeamLeague] = useState<League | null>(null)

  const [zipInput, setZipInput] = useState(state.location.zipCode ?? "")
  const [cityInput, setCityInput] = useState(state.location.city)
  const [stateInput, setStateInput] = useState(state.location.state)

  useEffect(() => {
    setZipInput(state.location.zipCode ?? "")
    setCityInput(state.location.city)
    setStateInput(state.location.state)
  }, [state.location.zipCode, state.location.city, state.location.state])

  useEffect(() => {
    if (stepHydratedFromUrl) return
    if (typeof window === "undefined") return
    const raw = new URLSearchParams(window.location.search).get("s")
    const allowed = new Set<string>(STEP_ORDER)
    if (raw && allowed.has(raw)) {
      setStep(raw as SetupStep)
    }
    setStepHydratedFromUrl(true)
  }, [stepHydratedFromUrl])

  useEffect(() => {
    if (step !== "teams") setSetupTeamLeague(null)
  }, [step])

  function goNext() {
    const i = stepIndex(step)
    if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]!)
  }

  function goBack() {
    if (step === "teams" && setupTeamLeague !== null) {
      setSetupTeamLeague(null)
      return
    }
    const i = stepIndex(step)
    if (i <= 0) return
    setStep(STEP_ORDER[i - 1]!)
  }

  function toggleFollowTeam(teamId: string, follow: boolean) {
    setDemoUserState((prev) => {
      const ids = prev.followedTeamIds
      if (follow) {
        if (ids.includes(teamId)) return prev
        return { ...prev, followedTeamIds: [...ids, teamId] }
      }
      if (ids.length <= 1) return prev
      return { ...prev, followedTeamIds: ids.filter((id) => id !== teamId) }
    })
  }

  const zipDigits = useMemo(() => zipInput.replace(/\D/g, ""), [zipInput])
  const zipValid = zipDigits.length >= 5

  function applyLocationDraft(): boolean {
    if (!zipValid) return false
    const zipDisplay =
      zipDigits.length > 5 ? `${zipDigits.slice(0, 5)}-${zipDigits.slice(5, 9)}` : zipDigits.slice(0, 5)
    const city = cityInput.trim()
    const st = stateInput.trim().toUpperCase().slice(0, 2)
    setDemoUserState((prev) => {
      const nextCity = city || prev.location.city
      const nextState = st || prev.location.state
      const parts = [nextCity, nextState].filter(Boolean)
      const marketLabel =
        parts.length > 0 ? `${parts.join(", ")} · ZIP ${zipDisplay}` : `ZIP ${zipDisplay}`
      return {
        ...prev,
        location: {
          ...prev.location,
          zipCode: zipDisplay,
          city: nextCity,
          state: nextState,
          marketLabel,
        },
      }
    })
    return true
  }

  function completeSetup() {
    setDemoUserState((prev) => ({
      ...prev,
      hasCompletedSetup: true,
      setupVersion: prev.setupVersion ?? 1,
    }))
    setStep("finish")
  }

  function exitToHome() {
    setSetupDeferred()
    router.push("/")
  }

  const progress = Math.round(((stepIndex(step) + 1) / STEP_ORDER.length) * 100)
  const signedIn = Boolean(user)

  useEffect(() => {
    if (step !== "finish" || state.hasCompletedSetup) return
    setDemoUserState((prev) => ({
      ...prev,
      hasCompletedSetup: true,
      setupVersion: prev.setupVersion ?? 1,
    }))
  }, [step, state.hasCompletedSetup, setDemoUserState])

  useEffect(() => {
    if (step !== "finish") return
    const t = window.setTimeout(() => {
      markSoftAuthSetupCompleteHomePending()
      router.replace("/")
    }, 2000)
    return () => window.clearTimeout(t)
  }, [step, router])

  return (
    <div className="min-h-screen bg-background pb-16 pt-[max(4.5rem,env(safe-area-inset-top)+3rem)]">
      <header className="fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-40 px-3">
        <div className="mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-border/60 bg-card/90 px-2 py-2 shadow-sm backdrop-blur-md">
          {step !== "welcome" && step !== "finish" ? (
            <Button type="button" variant="ghost" size="icon" onClick={goBack} aria-label="Back">
              <ChevronLeft className="size-5" />
            </Button>
          ) : (
            <div className="size-10 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted-foreground">Setup</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4">
        {step === "welcome" && (
          <Card className="border-border p-6">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent/15">
              <Sparkles className="size-6 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome to GamePlan</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A short setup tailors teams, your home area, and preferences. You can do this without
              signing in—login is optional and saves your setup across devices.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button type="button" onClick={() => setStep("teams")}>
                Get started
              </Button>
              <Button type="button" variant="outline" onClick={exitToHome}>
                Browse the app without setup
              </Button>
            </div>
          </Card>
        )}

        {step === "teams" && (
          <SetupTeamsStep
            league={setupTeamLeague}
            onLeagueChange={setSetupTeamLeague}
            followedTeamIds={state.followedTeamIds}
            onToggleTeam={toggleFollowTeam}
            onContinue={goNext}
          />
        )}

        {step === "location" && (
          <Card className="border-border p-5">
            <h2 className="text-lg font-semibold text-foreground">Your home ZIP</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Location helps show local games and blackout restrictions accurately.
            </p>
            <div className="mt-5 space-y-2">
              <Label htmlFor="setup-zip">ZIP code (required)</Label>
              <Input
                id="setup-zip"
                className="mt-1.5"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="e.g. 63101"
                value={zipInput}
                onChange={(e) => setZipInput(e.target.value)}
                aria-invalid={zipInput.length > 0 && !zipValid}
              />
              <p className="text-xs text-muted-foreground">US ZIP — at least 5 digits.</p>
            </div>
            <div className="mt-5 space-y-3 rounded-lg border border-border/60 bg-secondary/20 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                City &amp; state (optional)
              </p>
              <div>
                <Label htmlFor="setup-city">City</Label>
                <Input
                  id="setup-city"
                  className="mt-1.5"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  autoComplete="address-level2"
                />
              </div>
              <div>
                <Label htmlFor="setup-state">State (2 letters)</Label>
                <Input
                  id="setup-state"
                  className="mt-1.5"
                  maxLength={2}
                  value={stateInput}
                  onChange={(e) => setStateInput(e.target.value)}
                  autoComplete="address-level1"
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
              <div className="min-w-0 pr-2">
                <p className="text-sm font-medium text-foreground">Regional location</p>
                <p className="text-xs text-muted-foreground">
                  Use my ZIP for regional schedules, local listings, and blackout context.
                </p>
              </div>
              <Switch
                checked={state.preferences.regionalLocationEnabled}
                onCheckedChange={(v) =>
                  setDemoUserState((prev) => ({
                    ...prev,
                    preferences: { ...prev.preferences, regionalLocationEnabled: v },
                  }))
                }
              />
            </div>
            <Button
              type="button"
              className="mt-5 w-full"
              disabled={!zipValid}
              onClick={() => {
                if (!applyLocationDraft()) return
                goNext()
              }}
            >
              Continue
            </Button>
          </Card>
        )}

        {step === "preferences" && (
          <Card className="border-border p-5">
            <h2 className="text-lg font-semibold text-foreground">Quick preferences</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Two switches—adjust anytime in Settings.
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-foreground">Dark mode</p>
                  <p className="text-xs text-muted-foreground">Saved now; full theme polish may follow.</p>
                </div>
                <Switch
                  checked={state.preferences.darkMode}
                  onCheckedChange={(v) =>
                    setDemoUserState((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, darkMode: v },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">Game-time heads-ups (demo).</p>
                </div>
                <Switch
                  checked={state.preferences.notificationsEnabled}
                  onCheckedChange={(v) =>
                    setDemoUserState((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, notificationsEnabled: v },
                    }))
                  }
                />
              </div>
            </div>
            <Button type="button" className="mt-4 w-full" onClick={goNext}>
              Continue
            </Button>
          </Card>
        )}

        {step === "account" && (
          <Card className="border-border p-5">
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent/15">
              <Cloud className="size-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Save your setup</h2>
            <p className="mt-1 text-sm font-medium text-foreground">Access from any device</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Optional: use an account to back up what you just chose. You can keep using GamePlan on
              this device without one.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Teams, ZIP, and preferences stay in sync when you sign in.</li>
              <li>Open the same setup on another browser or phone.</li>
            </ul>
            {!authReady && (
              <p className="mt-3 text-sm text-muted-foreground">Checking account status…</p>
            )}
            {authReady && signedIn && (
              <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground">
                You&apos;re signed in as{" "}
                <span className="font-medium">{user?.email ?? "your account"}</span>. Your setup is
                being saved to your account automatically.
              </p>
            )}
            {authReady && !signedIn && supabaseConfigured && (
              <div className="mt-5 flex flex-col gap-2">
                <Button type="button" asChild className="w-full">
                  <Link href={`/auth/sign-in?next=${SETUP_ACCOUNT_AUTH_NEXT}`}>Sign in</Link>
                </Button>
                <Button type="button" variant="secondary" className="w-full" asChild>
                  <Link href={`/auth/sign-in?next=${SETUP_ACCOUNT_AUTH_NEXT}&register=1`}>
                    Create account
                  </Link>
                </Button>
                <Button type="button" variant="ghost" className="w-full text-muted-foreground" onClick={completeSetup}>
                  Continue without account
                </Button>
              </div>
            )}
            {authReady && !signedIn && !supabaseConfigured && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Cloud sign-in isn&apos;t configured here, so accounts are unavailable. Your setup
                  stays on this device only—you can still finish onboarding.
                </p>
                <Button type="button" className="mt-4 w-full" onClick={completeSetup}>
                  Continue without account
                </Button>
              </>
            )}
            {authReady && signedIn && (
              <Button type="button" className="mt-4 w-full" onClick={completeSetup}>
                Finish setup
              </Button>
            )}
          </Card>
        )}

        {step === "finish" && (
          <Card className="border-border p-6 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="size-6 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">You&apos;re set up</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Jumping to Home in a moment—you can leave anytime using the link above.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  markSoftAuthSetupCompleteHomePending()
                  router.replace("/")
                }}
              >
                Continue to Home
              </Button>
              <p className="text-[11px] text-muted-foreground">No need to wait—Home opens automatically.</p>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
