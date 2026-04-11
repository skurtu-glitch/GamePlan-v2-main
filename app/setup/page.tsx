"use client"

import { useEffect, useState } from "react"
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
import { setSetupDeferred } from "@/lib/setup-session"
import type { League } from "@/lib/types"
import { Check, ChevronLeft, Cloud, Sparkles } from "lucide-react"

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

  function applyLocationDraft() {
    const zip = zipInput.trim()
    const city = cityInput.trim()
    const st = stateInput.trim().toUpperCase().slice(0, 2)
    setDemoUserState((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        zipCode: zip || prev.location.zipCode,
        city: city || prev.location.city,
        state: st || prev.location.state,
        marketLabel:
          zip || city || st
            ? [city || prev.location.city, st || prev.location.state].filter(Boolean).join(", ") +
              (zip ? ` · ZIP ${zip}` : "")
            : prev.location.marketLabel,
      },
    }))
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
            <h2 className="text-lg font-semibold text-foreground">Home area</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Used for regional labels and market context in the app.
            </p>
            <div className="mt-4 space-y-3">
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
              <div>
                <Label htmlFor="setup-zip">ZIP (optional)</Label>
                <Input
                  id="setup-zip"
                  className="mt-1.5"
                  inputMode="numeric"
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value)}
                  autoComplete="postal-code"
                />
              </div>
            </div>
            <Button
              type="button"
              className="mt-5 w-full"
              onClick={() => {
                applyLocationDraft()
                goNext()
              }}
            >
              Continue
            </Button>
          </Card>
        )}

        {step === "preferences" && (
          <Card className="border-border p-5">
            <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tune how GamePlan feels for you.</p>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="setup-display">Display name</Label>
                <Input
                  id="setup-display"
                  className="mt-1.5"
                  value={state.preferences.displayName}
                  onChange={(e) =>
                    setDemoUserState((prev) => ({
                      ...prev,
                      preferences: { ...prev.preferences, displayName: e.target.value },
                    }))
                  }
                  autoComplete="nickname"
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Dark mode</p>
                  <p className="text-xs text-muted-foreground">Comfortable viewing at night</p>
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
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">Game-time reminders (demo)</p>
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
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Regional location</p>
                  <p className="text-xs text-muted-foreground">Uses your home area in settings</p>
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
            </div>
            <Button type="button" className="mt-5 w-full" onClick={goNext}>
              Continue
            </Button>
          </Card>
        )}

        {step === "account" && (
          <Card className="border-border p-5">
            <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent/15">
              <Cloud className="size-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Save &amp; sync (optional)</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sign in to back up this setup and open it on your other devices. You can skip and stay
              local-only on this browser.
            </p>
            {!authReady && (
              <p className="mt-3 text-sm text-muted-foreground">Checking account status…</p>
            )}
            {authReady && signedIn && (
              <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground">
                You&apos;re signed in as{" "}
                <span className="font-medium">{user?.email ?? "your account"}</span>. Your setup will
                sync automatically.
              </p>
            )}
            {authReady && !signedIn && supabaseConfigured && (
              <div className="mt-4 flex flex-col gap-2">
                <Button type="button" asChild>
                  <Link href="/auth/sign-in?next=%2Fsetup%3Fs%3Daccount">Sign in to save</Link>
                </Button>
                <Button type="button" variant="outline" onClick={completeSetup}>
                  Skip for now
                </Button>
              </div>
            )}
            {authReady && !signedIn && !supabaseConfigured && (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Cloud sign-in is not configured in this build. Continue locally—your choices are
                  still saved in this browser.
                </p>
                <Button type="button" className="mt-4 w-full" onClick={completeSetup}>
                  Finish setup
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
            <h2 className="text-xl font-bold text-foreground">You&apos;re set</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Teams, location, and preferences are saved. Explore the schedule and assistant anytime.
            </p>
            <Button type="button" className="mt-6 w-full" asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </Card>
        )}
      </main>
    </div>
  )
}
