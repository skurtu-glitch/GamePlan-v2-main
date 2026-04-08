"use client"

import { useState } from "react"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
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
} from "lucide-react"

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
      <button className="w-full" onClick={() => onChange?.(!value)}>
        {content}
      </button>
    )
  }

  return <button className="w-full">{content}</button>
}

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true)
  const [location, setLocation] = useState(true)
  const [darkMode, setDarkMode] = useState(true)

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
            <Settings className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">Customize your experience</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        
        {/* Connected Services - Prominent */}
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
                  <p className="text-sm text-muted-foreground">2 services connected</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                    78% coverage
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              </div>
            </Link>
          </Card>
        </section>

        {/* Preferences */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Preferences
          </h2>
          <Card className="overflow-hidden divide-y divide-border p-0">
            <SettingItem
              icon={Users}
              label="Teams Followed"
              description="Blues, Cardinals"
              href="/teams"
            />
            <SettingItem
              icon={MapPin}
              label="Location"
              description="St. Louis, MO (for regional availability)"
              toggle
              value={location}
              onChange={setLocation}
            />
            <SettingItem
              icon={Bell}
              label="Notifications"
              description="Game alerts and updates"
              toggle
              value={notifications}
              onChange={setNotifications}
            />
            <SettingItem
              icon={Moon}
              label="Dark Mode"
              description="Always on"
              toggle
              value={darkMode}
              onChange={setDarkMode}
            />
          </Card>
        </section>

        {/* Data Clarity */}
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

        {/* Support */}
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

        {/* Account */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Account
          </h2>
          <Card className="overflow-hidden p-0">
            <button className="flex w-full items-center gap-4 p-4 text-left text-red-400 transition-colors hover:bg-red-500/10">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-500/15">
                <LogOut className="size-5" />
              </div>
              <span className="font-medium">Sign Out</span>
            </button>
          </Card>
        </section>

        {/* Version */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          GamePlan v1.0.0
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
