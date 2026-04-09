"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink, Tv } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import {
  AnalyticsEvent,
  analyticsBase,
  trackEvent,
} from "@/lib/analytics"
import { serviceDisplayName } from "@/lib/streaming-service-ids"
import {
  providerWatchHomeUrl,
  watchOpenButtonLabel,
} from "@/lib/watch-open"

export function WatchStubClient({
  rawServiceIdSegment,
  gameId,
}: {
  rawServiceIdSegment: string
  gameId: string
}) {
  const { state } = useDemoUser()

  const serviceId =
    rawServiceIdSegment === "demo"
      ? undefined
      : decodeURIComponent(rawServiceIdSegment)
  const providerLabel = serviceId ? serviceDisplayName(serviceId) : "your streaming provider"
  const outbound = serviceId ? providerWatchHomeUrl(serviceId) : undefined

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link
              href={gameId ? `/game/${gameId}` : "/"}
              onClick={() =>
                trackEvent(AnalyticsEvent.watchActionClick, {
                  ...analyticsBase("watch_stub", state, {
                    href: gameId ? `/game/${gameId}` : "/",
                    label: "watch_stub_back",
                    game_id: gameId || undefined,
                  }),
                })
              }
            >
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold text-foreground">Watch next steps</h1>
            <p className="text-xs text-muted-foreground">{providerLabel}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <Card className="border-border bg-card p-5">
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-status-available/15">
            <Tv className="size-6 text-status-available" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {watchOpenButtonLabel(serviceId)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This GamePlan demo doesn&apos;t embed live video. In a full product, this screen would
            deep-link into {providerLabel} (app or web) already signed in, or show the exact program
            for your game.
          </p>
          {gameId ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Game id: <span className="font-mono text-foreground/80">{gameId}</span>
            </p>
          ) : null}
          {outbound ? (
            <Button className="mt-6 w-full gap-2" size="lg" asChild>
              <a
                href={outbound}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent(AnalyticsEvent.watchActionClick, {
                    ...analyticsBase("watch_stub", state, {
                      href: outbound,
                      label: "watch_stub_provider_site",
                      game_id: gameId || undefined,
                      ...(serviceId ? { plan_id: serviceId } : {}),
                    }),
                  })
                }
              >
                <ExternalLink className="size-4" />
                Open {providerLabel} website
              </a>
            </Button>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No demo outbound link is mapped for this provider yet—use Connected Services to manage
              subscriptions, or compare plans for bundles that include this feed.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" asChild>
              <Link
                href="/settings/services"
                onClick={() =>
                  trackEvent(AnalyticsEvent.connectedServicesClick, {
                    ...analyticsBase("watch_stub", state, {
                      href: "/settings/services",
                      label: "watch_stub_services",
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
                    ...analyticsBase("watch_stub", state, {
                      href: "/plans",
                      label: "watch_stub_plans",
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
