"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Headphones } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import {
  AnalyticsEvent,
  analyticsBase,
  trackEvent,
} from "@/lib/analytics"

export default function ListenStubPage() {
  const searchParams = useSearchParams()
  const gameId = searchParams.get("gameId") ?? ""
  const { state } = useDemoUser()

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link
              href={gameId ? `/game/${gameId}` : "/"}
              onClick={() =>
                trackEvent(AnalyticsEvent.listenActionClick, {
                  ...analyticsBase("listen_stub", state, {
                    href: gameId ? `/game/${gameId}` : "/",
                    label: "listen_stub_back",
                    game_id: gameId || undefined,
                  }),
                })
              }
            >
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold text-foreground">Listen next steps</h1>
            <p className="text-xs text-muted-foreground">Audio in the GamePlan demo</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-status-partial/15">
            <Headphones className="size-6 text-status-partial" />
          </div>
          <p className="text-base font-semibold text-foreground">How to listen</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This GamePlan demo doesn&apos;t embed live audio. In a full product, this screen would
            deep-link into the team app, radio station stream, or league audio product for this
            game.
          </p>
          {gameId ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Game id: <span className="font-mono text-foreground/80">{gameId}</span>
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" asChild>
              <Link
                href="/settings/services"
                onClick={() =>
                  trackEvent(AnalyticsEvent.connectedServicesClick, {
                    ...analyticsBase("listen_stub", state, {
                      href: "/settings/services",
                      label: "listen_stub_services",
                      game_id: gameId || undefined,
                    }),
                  })
                }
              >
                Connected Services
              </Link>
            </Button>
            <Button variant="secondary" className="flex-1" asChild>
              <Link
                href="/plans"
                onClick={() =>
                  trackEvent(AnalyticsEvent.comparePlansClick, {
                    ...analyticsBase("listen_stub", state, {
                      href: "/plans",
                      label: "listen_stub_plans",
                      game_id: gameId || undefined,
                    }),
                  })
                }
              >
                Compare plans
              </Link>
            </Button>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  )
}
