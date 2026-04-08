"use client"

import { useState } from "react"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Check,
  Plus,
  Tv,
  Radio,
  Trophy,
  X,
  ChevronRight,
  Zap,
} from "lucide-react"
import { serviceDisplayName } from "@/lib/streaming-service-ids"

interface StreamingService {
  id: string
  name: string
  description: string
  category: "tv" | "league" | "audio"
  icon: "tv" | "trophy" | "radio"
  price?: string
  gamesUnlocked?: number
}

const allServices: StreamingService[] = [
  // TV & Streaming
  { id: "fanduel-sports", name: serviceDisplayName("fanduel-sports"), description: "Regional sports networks", category: "tv", icon: "tv", price: "$19.99/mo", gamesUnlocked: 41 },
  { id: "max", name: serviceDisplayName("max"), description: "HBO + TNT Sports", category: "tv", icon: "tv", price: "$9.99/mo", gamesUnlocked: 12 },
  { id: "directv", name: serviceDisplayName("directv"), description: "Live TV with RSN options", category: "tv", icon: "tv", price: "$64.99/mo", gamesUnlocked: 65 },
  { id: "youtube-tv", name: serviceDisplayName("youtube-tv"), description: "Live TV with cloud DVR", category: "tv", icon: "tv", price: "$72.99/mo", gamesUnlocked: 58 },
  // League Passes
  { id: "espn-plus", name: serviceDisplayName("espn-plus"), description: "Out-of-market NHL games", category: "league", icon: "trophy", price: "$10.99/mo", gamesUnlocked: 33 },
  { id: "mlb-tv", name: serviceDisplayName("mlb-tv"), description: "Out-of-market MLB games", category: "league", icon: "trophy", price: "$149.99/yr", gamesUnlocked: 81 },
  // Audio
  { id: "team-radio", name: serviceDisplayName("team-radio"), description: "Free local broadcasts", category: "audio", icon: "radio", price: "Free", gamesUnlocked: 244 },
  { id: "siriusxm", name: serviceDisplayName("siriusxm"), description: "Satellite radio sports", category: "audio", icon: "radio", price: "$10.99/mo", gamesUnlocked: 244 },
]

export default function ConnectedServicesPage() {
  const { state, toggleConnectedService } = useDemoUser()
  const connectedIds = state.connectedServiceIds
  const [selectedService, setSelectedService] = useState<StreamingService | null>(null)

  const connectedServices = allServices.filter((s) => connectedIds.includes(s.id))
  const availableServices = allServices.filter((s) => !connectedIds.includes(s.id))

  const ServiceIcon = ({ type }: { type: "tv" | "trophy" | "radio" }) => {
    switch (type) {
      case "tv": return <Tv className="size-5" />
      case "trophy": return <Trophy className="size-5" />
      case "radio": return <Radio className="size-5" />
    }
  }

  // Service Detail Modal/Drawer
  if (selectedService) {
    const isConnected = connectedIds.includes(selectedService.id)
    
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
            <button
              onClick={() => setSelectedService(null)}
              className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{selectedService.name}</h1>
              <p className="text-xs text-muted-foreground">{isConnected ? "Connected" : "Not Connected"}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-4 py-6">
          {/* Service Info */}
          <Card className="mb-6 overflow-hidden border-border p-0">
            <div className="p-5">
              <div className="mb-4 flex items-center gap-4">
                <div className={`flex size-14 items-center justify-center rounded-xl ${isConnected ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"}`}>
                  <ServiceIcon type={selectedService.icon} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedService.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedService.description}</p>
                </div>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-secondary/50 p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{selectedService.price}</p>
                  <p className="text-xs text-muted-foreground">Monthly cost</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{selectedService.gamesUnlocked}</p>
                  <p className="text-xs text-muted-foreground">Games {isConnected ? "covered" : "unlocked"}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Coverage Impact */}
          {!isConnected && selectedService.gamesUnlocked && selectedService.gamesUnlocked > 0 && (
            <Card className="mb-6 overflow-hidden border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-0">
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Zap className="size-4 text-accent" />
                  <span className="text-xs font-medium uppercase tracking-wider text-accent">Coverage Impact</span>
                </div>
                <p className="text-sm text-foreground">
                  Adding {selectedService.name} would unlock <span className="font-bold text-emerald-400">{selectedService.gamesUnlocked} additional games</span> for your teams.
                </p>
              </div>
            </Card>
          )}

          {/* Example Games */}
          <section className="mb-6">
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Example Games {isConnected ? "Covered" : "Unlocked"}
            </h3>
            <Card className="overflow-hidden divide-y divide-border/50 p-0">
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Blues vs Rangers</p>
                  <p className="text-xs text-muted-foreground">Wed, Apr 9 · 7:00 PM</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-400">
                  <Check className="size-3" /> Watchable
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Cardinals vs Cubs</p>
                  <p className="text-xs text-muted-foreground">Thu, Apr 10 · 1:20 PM</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-400">
                  <Check className="size-3" /> Watchable
                </span>
              </div>
            </Card>
          </section>

          {/* CTA */}
          <Button
            className="w-full gap-2"
            variant={isConnected ? "outline" : "default"}
            onClick={() => {
              toggleConnectedService(selectedService.id)
              setSelectedService(null)
            }}
          >
            {isConnected ? (
              <>
                <X className="size-4" />
                Disconnect Service
              </>
            ) : (
              <>
                <Check className="size-4" />
                Connect Service
              </>
            )}
          </Button>
        </main>

        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <Link
            href="/settings"
            className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Connected Services</h1>
            <p className="text-xs text-muted-foreground">Manage your streaming subscriptions</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-lg px-4 py-6">
        
        {/* Your Services */}
        {connectedServices.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Your Services
              </h2>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                {connectedServices.length} connected
              </span>
            </div>
            <Card className="overflow-hidden divide-y divide-border p-0">
              {connectedServices.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-secondary/50"
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
                    <ServiceIcon type={service.icon} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{service.name}</p>
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                        <Check className="size-2.5" />
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Covers {service.gamesUnlocked} games
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </button>
              ))}
            </Card>
          </section>
        )}

        {/* Available Services */}
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Add Services
          </h2>
          <Card className="overflow-hidden divide-y divide-border p-0">
            {availableServices.map((service) => (
              <button
                key={service.id}
                onClick={() => setSelectedService(service)}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-secondary/50"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <ServiceIcon type={service.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{service.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{service.price}</span>
                    <span className="text-sm text-emerald-400">· Unlocks {service.gamesUnlocked} games</span>
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            ))}
          </Card>
        </section>

        {/* Explanation */}
        <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
          <p className="text-center text-sm text-muted-foreground">
            Your connected services determine what you can watch. GamePlan uses this to give you personalized coverage insights.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
