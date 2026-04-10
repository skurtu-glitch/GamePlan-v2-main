"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import { useSupabaseAuth } from "@/components/providers/supabase-auth-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Settings,
  Bell,
  MapPin,
  Moon,
  Tv,
  HelpCircle,
  Shield,
  ChevronRight,
  LogOut,
  Info,
  Users,
  Cloud,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { teamsForFollowedIds } from "@/lib/data"
import { getCurrentUserCoverageSummary } from "@/lib/current-user-coverage"
import { useScheduleOptional } from "@/components/providers/schedule-provider"

const PIPELINE_DEBUG = process.env.NEXT_PUBLIC_GAMEPLAN_PIPELINE_DEBUG === "1"

function PipelineDebugPanel() {
  const clientSchedule = useScheduleOptional()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || text !== null) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch("/api/gameplan/schedule")
        const json = await res.json()
        if (!cancelled) setText(JSON.stringify(json, null, 2))
      } catch (e) {
        if (!cancelled) setText(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, text])

  return (
    <section className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-3 flex w-full items-center justify-between text-left text-sm font-medium uppercase tracking-wider text-muted-foreground"
      >
        <span>Pipeline status (debug)</span>
        <ChevronRight
          className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <Card className="overflow-hidden border-dashed border-border p-3">
          {loading && (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
          {!loading && text && (
            <pre className="max-h-64 overflow-auto text-[10px] leading-snug text-muted-foreground">
              {text}
              {clientSchedule
                ? `\n\n--- client ScheduleProvider ---\n${JSON.stringify(
                    {
                      kind: clientSchedule.kind,
                      scheduleVersion: clientSchedule.scheduleVersion,
                      isHydrating: clientSchedule.isHydrating,
                      isReady: clientSchedule.isReady,
                      loadError: clientSchedule.loadError,
                      sourceUsed: clientSchedule.sourceUsed,
                      fallbackUsed: clientSchedule.fallbackUsed,
                      freshness: clientSchedule.freshness,
                      validation: clientSchedule.validation,
                      gameCount: clientSchedule.games.length,
                    },
                    null,
                    2
                  )}`
                : ""}
            </pre>
          )}
        </Card>
      )}
    </section>
  )
}

interface SettingItemProps {
  icon: React.ElementType
  label: string
  description?: string
  toggle?: boolean
  value?: boolean
  onChange?: (value: boolean) => void
  href?: string
}

function SettingItem({
  icon: Icon,
  label,
  description,
  toggle,
  value,
  onChange,
  href,
}: SettingItemProps) {
  const content = (
    <div className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-secondary/50">
      <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {toggle ? (
        <div
          className={`h-6 w-11 rounded-full transition-colors ${
            value ? "bg-accent" : "bg-secondary"
          }`}
        >
          <div
            className={`size-5 translate-y-0.5 rounded-full bg-foreground transition-transform ${
              value ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </div>
      ) : (
        <ChevronRight className="size-5 text-muted-foreground" />
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  if (toggle) {
    return (
      <button type="button" className="w-full" onClick={() => onChange?.(!value)}>
        {content}
      </button>
    )
  }

  return <button type="button" className="w-full">{content}</button>
}

export default function SettingsPage() {
  const { state, setDemoUserState, persistenceMode, cloudSyncStatus } = useDemoUser()
  const { user, signOut, supabaseConfigured, ready: authReady } = useSupabaseAuth()
  const [signingOut, setSigningOut] = useState(false)

  const [zipInput, setZipInput] = useState(state.location.zipCode ?? "")
  const [cityInput, setCityInput] = useState(state.location.city)
  const [stateInput, setStateInput] = useState(state.location.state)

  useEffect(() => {
    setZipInput(state.location.zipCode ?? "")
    setCityInput(state.location.city)
    setStateInput(state.location.state)
  }, [state.location.zipCode, state.location.city, state.location.state])

  const coverage = useMemo(
    () => getCurrentUserCoverageSummary("both", state),
    [state]
  )

  const followedTeams = useMemo(
    () => teamsForFollowedIds(state.followedTeamIds),
    [state.followedTeamIds]
  )

  const followedLabel =
    followedTeams.length > 0
      ? followedTeams.map((t) => `${t.city} ${t.name}`).join(" · ")
      : "No teams selected"

  const connectedCount = state.connectedServiceIds.length

  function applyLocation() {
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

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  const signedIn = Boolean(user)
  const accountEmail = user?.email ?? ""

  const syncHint = (() => {
    if (persistenceMode !== "cloud") return null
    if (cloudSyncStatus === "syncing") {
      return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Saving to your account…
        </span>
      )
    }
    if (cloudSyncStatus === "saved") {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <Check className="size-3.5" />
          Saved to your account
        </span>
      )
    }
    if (cloudSyncStatus === "error") {
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
          <AlertCircle className="size-3.5" />
          Couldn&apos;t reach the server — check your connection
        </span>
      )
    }
    return (
      <span className="text-xs text-muted-foreground">
        Changes sync to your account automatically.
      </span>
    )
  })()

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">Your GamePlan setup</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Persistence + account */}
        {authReady && supabaseConfigured && signedIn && (
          <Card className="mb-6 overflow-hidden border-accent/25 bg-accent/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Cloud className="size-4 text-accent" />
              <span className="text-sm font-medium text-foreground">Account-backed setup</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Teams, location, streaming services, and preferences are stored with your GamePlan
              account and load when you sign in on this or another device.
            </p>
            {accountEmail && (
              <p className="mt-3 text-xs text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">{accountEmail}</span>
              </p>
            )}
            <div className="mt-3 border-t border-border/60 pt-3">{syncHint}</div>
          </Card>
        )}

        {authReady && supabaseConfigured && !signedIn && (
          <Card className="mb-6 border-border p-4">
            <p className="text-sm font-medium text-foreground">Local-only on this device</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You&apos;re not signed in. Your setup is saved in this browser only. Sign in below to
              back it up and use it on other devices.
            </p>
          </Card>
        )}

        {authReady && !supabaseConfigured && (
          <Card className="mb-6 border-border p-4">
            <p className="text-sm font-medium text-foreground">Cloud sync unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add{" "}
              <code className="rounded bg-secondary px-1 text-xs">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-secondary px-1 text-xs">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>{" "}
              to enable sign-in. Until then, everything stays on this device.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Storage mode:{" "}
              <span className="font-medium text-foreground">this device only</span>
            </p>
          </Card>
        )}

        {/* Connected Services */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Streaming Services
          </h2>
          <Card className="overflow-hidden border-border p-0">
            <Link href="/settings/services">
              <div className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/50">
                <div className="flex size-12 items-center justify-center rounded-xl bg-accent/15">
                  <Tv className="size-6 text-accent" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Connected Services</p>
                  <p className="text-sm text-muted-foreground">
                    {connectedCount === 0
                      ? "No services connected"
                      : `${connectedCount} service${connectedCount === 1 ? "" : "s"} connected`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    {coverage.coveragePercent}% coverage
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              </div>
            </Link>
          </Card>
        </section>

        {/* Your setup: teams + location */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Your setup
          </h2>
          <Card className="space-y-4 overflow-hidden border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {persistenceMode === "cloud" ? (
                  <>
                    Storage:{" "}
                    <span className="font-medium text-foreground">your account</span>
                  </>
                ) : (
                  <>
                    Storage:{" "}
                    <span className="font-medium text-foreground">this device</span>
                  </>
                )}
              </p>
              {persistenceMode === "cloud" && cloudSyncStatus === "idle" && (
                <span className="text-xs text-muted-foreground">Auto-save on</span>
              )}
            </div>

            <Link
              href="/teams"
              className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/40"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Followed teams</p>
                <p className="truncate text-xs text-muted-foreground">{followedLabel}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="size-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Home location</span>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                ZIP is used first for market hints; city and state refine regional availability and
                blackout-style rules in the demo model.
              </p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="gp-zip" className="mb-1 block text-xs text-muted-foreground">
                    ZIP code
                  </label>
                  <input
                    id="gp-zip"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    value={zipInput}
                    onChange={(e) => setZipInput(e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
                    placeholder="63101"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="gp-city" className="mb-1 block text-xs text-muted-foreground">
                      City
                    </label>
                    <input
                      id="gp-city"
                      autoComplete="address-level2"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor="gp-state" className="mb-1 block text-xs text-muted-foreground">
                      State
                    </label>
                    <input
                      id="gp-state"
                      autoComplete="address-level1"
                      value={stateInput}
                      onChange={(e) => setStateInput(e.target.value)}
                      maxLength={2}
                      className="h-10 w-full rounded-lg border border-border bg-secondary/40 px-3 text-sm uppercase text-foreground outline-none focus:ring-2 focus:ring-accent"
                      placeholder="MO"
                    />
                  </div>
                </div>
                <Button type="button" className="w-full" onClick={applyLocation}>
                  Save location
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 text-left"
                onClick={() =>
                  setDemoUserState((prev) => ({
                    ...prev,
                    preferences: {
                      ...prev.preferences,
                      regionalLocationEnabled: !prev.preferences.regionalLocationEnabled,
                    },
                  }))
                }
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Use location for regional rules
                  </p>
                  <p className="text-xs text-muted-foreground">
                    When off, market-specific video rules are not applied from your saved address.
                  </p>
                </div>
                <div
                  className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
                    state.preferences.regionalLocationEnabled ? "bg-accent" : "bg-secondary"
                  }`}
                >
                  <div
                    className={`size-5 translate-y-0.5 rounded-full bg-foreground transition-transform ${
                      state.preferences.regionalLocationEnabled
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </div>
              </button>
            </div>
          </Card>
        </section>

        {/* Preferences */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Preferences
          </h2>
          <Card className="overflow-hidden divide-y divide-border p-0">
            <SettingItem
              icon={Bell}
              label="Notifications"
              description="Game alerts and updates"
              toggle
              value={state.preferences.notificationsEnabled}
              onChange={() =>
                setDemoUserState((prev) => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    notificationsEnabled: !prev.preferences.notificationsEnabled,
                  },
                }))
              }
            />
            <SettingItem
              icon={Moon}
              label="Dark Mode"
              description="Saved with your profile"
              toggle
              value={state.preferences.darkMode}
              onChange={() =>
                setDemoUserState((prev) => ({
                  ...prev,
                  preferences: {
                    ...prev.preferences,
                    darkMode: !prev.preferences.darkMode,
                  },
                }))
              }
            />
          </Card>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            How It Works
          </h2>
          <Card className="overflow-hidden border-border p-0">
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Info className="size-4 text-accent" />
                <span className="text-sm font-medium text-foreground">How coverage is calculated</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                GamePlan analyzes broadcast rights, regional availability rules, and your connected streaming services to show what you can watch or listen to. Coverage reflects your current service setup — when video is not available with your current plan, we still surface listen options and upgrade paths.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Support
          </h2>
          <Card className="overflow-hidden divide-y divide-border p-0">
            <SettingItem
              icon={HelpCircle}
              label="Help Center"
              description="FAQs and guides"
            />
            <SettingItem
              icon={Shield}
              label="Privacy Policy"
              description="How we use your data"
            />
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Account
          </h2>
          <Card className="overflow-hidden divide-y divide-border p-0">
            {supabaseConfigured && !signedIn && (
              <Link href="/auth/sign-in">
                <div className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-secondary/50">
                  <div className="flex size-10 items-center justify-center rounded-full bg-accent/15">
                    <Cloud className="size-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Sign in</p>
                    <p className="text-sm text-muted-foreground">
                      Sync this setup to your account
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              </Link>
            )}
            {signedIn && (
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-4 p-4 text-left text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-red-500/15">
                  <LogOut className="size-5" />
                </div>
                <span className="font-medium">{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            )}
          </Card>
        </section>

        {PIPELINE_DEBUG && <PipelineDebugPanel />}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          GamePlan v1.0.0
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
