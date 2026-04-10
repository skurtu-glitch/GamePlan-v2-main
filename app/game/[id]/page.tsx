"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Tv,
  Radio,
  Sparkles,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
  Play,
  Info,
  Zap,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getGameDetail } from "@/lib/game-details"
import { formatGameDetailAccess } from "@/lib/format-game-detail-access"
import {
  chooseMonetizedPrimaryLabel,
  isGameWithinHours,
  labelFixMyCoverage,
  labelGetBestValue,
  labelReviewDetails,
  socialProofRecommended,
  URGENCY_HOURS,
  valueJustificationBestValue,
} from "@/lib/conversion-copy"
import type { WatchOption, ListenFeed } from "@/lib/types"
import { cn } from "@/lib/utils"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import type { DemoUserState } from "@/lib/demo-user"
import { resolveGameAccess } from "@/lib/resolve-game-access"
import { getAffiliateLink, hasAffiliateLanding } from "@/lib/affiliate"
import {
  AnalyticsEvent,
  analyticsBase,
  trackAffiliateClick,
  trackEvent,
  trackListenOutbound,
} from "@/lib/analytics"
import { watchOpenButtonLabel, watchStubPath } from "@/lib/watch-open"
import { listenOpenButtonLabel, listenStubPath } from "@/lib/listen-open"
import {
  optimizerScopeForGame,
  resolveGameDetailUpgradeImpactId,
} from "@/lib/game-detail-upgrade"

function formatGameTime(dateTime: string) {
  const d = new Date(dateTime)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  let date: string
  if (d.toDateString() === now.toDateString()) {
    date = "Tonight"
  } else if (d.toDateString() === tomorrow.toDateString()) {
    date = "Tomorrow"
  } else {
    date = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
  }

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  return { date, time }
}

function useFormattedTime(dateTime: string) {
  const [formatted, setFormatted] = useState<{ date: string; time: string } | null>(null)
  useEffect(() => {
    setFormatted(formatGameTime(dateTime))
  }, [dateTime])
  return formatted
}

function LeagueBadge({ sport }: { sport: string }) {
  const colors: Record<string, string> = {
    NHL: "bg-blue-600",
    MLB: "bg-red-600",
    NFL: "bg-green-700",
    NBA: "bg-orange-600",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-bold text-white",
        colors[sport] || "bg-muted"
      )}
    >
      {sport}
    </span>
  )
}

function StatusIcon({ available }: { available: boolean }) {
  if (available) {
    return (
      <div className="flex size-5 items-center justify-center rounded-full bg-status-available/20">
        <Check className="size-3 text-status-available" />
      </div>
    )
  }
  return (
    <div className="flex size-5 items-center justify-center rounded-full bg-status-unavailable/20">
      <X className="size-3 text-status-unavailable" />
    </div>
  )
}

function WatchOptionRow({
  option,
  gameId,
  userState,
}: {
  option: WatchOption
  gameId: string
  userState: DemoUserState
}) {
  const gameRow = getGameDetail(gameId)
  const within24h = gameRow
    ? isGameWithinHours(gameRow.dateTime, URGENCY_HOURS, new Date())
    : false
  const affiliateHref =
    option.serviceId && hasAffiliateLanding(option.serviceId)
      ? getAffiliateLink(option.serviceId, {
          sourceScreen: "game_detail",
          intent: "game_watch_row_subscribe",
        })
      : null

  return (
    <div className="flex items-start gap-3 py-3">
      <StatusIcon available={option.available} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{option.provider}</span>
          {option.hasSubscription && (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs font-medium text-accent">
              Subscribed
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{option.reason}</p>
        {option.price && !option.hasSubscription && (
          <p className="mt-1 text-sm text-muted-foreground">{option.price}</p>
        )}
      </div>
      {option.available && (
        <Button
          size="sm"
          className="shrink-0 bg-status-available text-white hover:bg-status-available/90"
          asChild
        >
          <Link
            href={watchStubPath(option.serviceId, gameId)}
            onClick={() =>
              trackEvent(AnalyticsEvent.watchActionClick, {
                ...analyticsBase("game_detail", userState, {
                  href: watchStubPath(option.serviceId, gameId),
                  label: "watch_section_open_row",
                  game_id: gameId,
                  ...(option.serviceId ? { plan_id: option.serviceId } : {}),
                }),
              })
            }
          >
            <ExternalLink className="mr-1 size-3" />
            Open
          </Link>
        </Button>
      )}
      {!option.available && !option.hasSubscription && (option.price || affiliateHref) && (
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          {affiliateHref && option.serviceId ? (
            <a
              href={affiliateHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                  ...analyticsBase("game_detail", userState, {
                    label: chooseMonetizedPrimaryLabel({
                      within24h,
                      planName: "",
                    }),
                    game_id: gameId,
                    service_id: option.serviceId,
                    intent: "game_watch_row_subscribe",
                  }),
                })
                trackAffiliateClick(affiliateHref, "game_detail", userState, {
                  label: "watch_row_start_service",
                  game_id: gameId,
                  service_id: option.serviceId,
                  intent: "game_watch_row_subscribe",
                })
              }}
            >
              <Plus className="mr-1 size-3" />
              {chooseMonetizedPrimaryLabel({ within24h, planName: "" })}
            </a>
          ) : (
            <Link
              href="/settings/services"
              onClick={() =>
                trackEvent(AnalyticsEvent.connectedServicesClick, {
                  ...analyticsBase("game_detail", userState, {
                    href: "/settings/services",
                    label: "watch_option_add",
                    game_id: gameId,
                  }),
                })
              }
            >
              <Plus className="mr-1 size-3" />
              {labelFixMyCoverage()}
            </Link>
          )}
        </Button>
      )}
    </div>
  )
}

function ListenFeedRow({
  feed,
  gameId,
  userState,
}: {
  feed: ListenFeed
  gameId: string
  userState: DemoUserState
}) {
  const typeLabels: Record<string, string> = {
    home: "Home",
    away: "Away",
    national: "National",
  }
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-5 items-center justify-center rounded-full bg-status-available/20">
        <Check className="size-3 text-status-available" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{feed.name}</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
            {typeLabels[feed.type]}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{feed.provider}</p>
      </div>
      <div className="flex items-center gap-2">
        {feed.free ? (
          <span className="rounded bg-status-available/20 px-2 py-0.5 text-xs font-medium text-status-available">
            Free
          </span>
        ) : (
          <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            Paid
          </span>
        )}
        {feed.url && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={feed.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackListenOutbound(feed.url!, "game_detail", userState, {
                  game_id: gameId,
                  label: "listen_feed_row",
                  feed_type: feed.type,
                })
              }
            >
              <Play className="mr-1 size-3" />
              Listen
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { state } = useDemoUser()
  const [showWhyPanel, setShowWhyPanel] = useState(false)

  const game = getGameDetail(id)
  const upgradeScope = game ? optimizerScopeForGame(game) : "both"
  const upgradeImpactId = resolveGameDetailUpgradeImpactId(upgradeScope, state)
  const upgradeHref = upgradeImpactId ? `/plans/upgrade/${upgradeImpactId}` : null
  const access = game ? resolveGameAccess(game, state) : null
  const accessUi =
    game && access ? formatGameDetailAccess(game, access, state) : null

  useEffect(() => {
    if (!game) return
    trackEvent(AnalyticsEvent.decisionShown, {
      ...analyticsBase("game_detail", state, {
        game_id: id,
        surface: "game_best_value",
      }),
    })
  }, [game, id, state])

  /** Prefer primary home feed URL — aligns with `game.listen` / resolver flagship. */
  const listenAudioUrl =
    game?.listenFeeds.find((f) => f.type === "home" && f.url)?.url ??
    game?.listenFeeds.find((f) => f.url)?.url
  const formatted = useFormattedTime(game?.dateTime ?? "")

  if (!game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <p className="text-muted-foreground">Game not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
          Go Home
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate font-semibold text-foreground">
              {game.awayTeam.name} @ {game.homeTeam.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {formatted?.date ?? "..."} {formatted?.time && `\u00b7 ${formatted.time}`}
            </p>
          </div>
          <LeagueBadge sport={game.homeTeam.sport} />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Matchup Card */}
        <Card className="mb-6 overflow-hidden border-border bg-card p-0">
          <div className="flex items-center justify-center gap-6 p-6">
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: game.awayTeam.primaryColor }}
              >
                {game.awayTeam.abbreviation}
              </div>
              <span className="text-sm font-medium text-foreground">
                {game.awayTeam.city}
              </span>
              <span className="text-xs text-muted-foreground">
                {game.awayTeam.name}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-muted-foreground">@</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex size-16 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: game.homeTeam.primaryColor }}
              >
                {game.homeTeam.abbreviation}
              </div>
              <span className="text-sm font-medium text-foreground">
                {game.homeTeam.city}
              </span>
              <span className="text-xs text-muted-foreground">
                {game.homeTeam.name}
              </span>
            </div>
          </div>
          {game.venue && (
            <div className="border-t border-border/50 px-6 py-3 text-center">
              <p className="text-xs text-muted-foreground">{game.venue}</p>
            </div>
          )}
        </Card>

        {/* Best Value (primary path for this game) */}
        {accessUi && (
        <section className="mb-6">
          <Card
            className={cn(
              "overflow-hidden border-2 p-0",
              accessUi.bestOption.type === "watch"
                ? "border-status-available bg-status-available/5"
                : "border-status-partial bg-status-partial/5"
            )}
          >
            <div className="px-4 py-4">
              <p className="mb-3 text-[11px] font-semibold leading-snug text-accent">
                {accessUi.conversionHook}
              </p>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles
                  className={cn(
                    "size-5",
                    accessUi.bestOption.type === "watch"
                      ? "text-status-available"
                      : "text-status-partial"
                  )}
                />
                <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Best Value
                </span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Decision
              </p>
              <h2
                className={cn(
                  "mb-2 text-xl font-bold",
                  accessUi.bestOption.type === "watch"
                    ? "text-status-available"
                    : "text-status-partial"
                )}
              >
                {accessUi.bestOption.type === "watch" ? "Watch" : "Just Listen"} on{" "}
                {accessUi.bestOption.provider}
              </h2>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Why
              </p>
              <p className="leading-relaxed text-muted-foreground">
                {accessUi.bestOption.explanation}
              </p>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Next
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                {accessUi.bestOption.type === "listen" &&
                  (listenAudioUrl ? (
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                      <a
                        href={listenAudioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                            ...analyticsBase("game_detail", state, {
                              game_id: id,
                              label: "open_audio_best_option",
                            }),
                          })
                          trackListenOutbound(listenAudioUrl, "game_detail", state, {
                            game_id: id,
                            label: "open_audio_best_option",
                          })
                        }}
                      >
                        <Play className="mr-2 size-4" />
                        Open Audio
                      </a>
                    </Button>
                  ) : (
                    <Button
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                      asChild
                    >
                      <Link
                        href={listenStubPath(id)}
                        onClick={() => {
                          trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                            ...analyticsBase("game_detail", state, {
                              href: listenStubPath(id),
                              label: "open_audio_best_value_stub",
                              game_id: id,
                            }),
                          })
                          trackEvent(AnalyticsEvent.listenActionClick, {
                            ...analyticsBase("game_detail", state, {
                              href: listenStubPath(id),
                              label: "open_audio_best_value_stub",
                              game_id: id,
                            }),
                          })
                        }}
                      >
                        <Play className="mr-2 size-4" />
                        {listenOpenButtonLabel()}
                      </Link>
                    </Button>
                  ))}
                {accessUi.bestOption.type === "watch" && (
                  <Button
                    className="bg-status-available text-white hover:bg-status-available/90"
                    asChild
                  >
                    <Link
                      href={watchStubPath(accessUi.bestOption.primaryWatchServiceId, id)}
                      onClick={() => {
                        trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                          ...analyticsBase("game_detail", state, {
                            href: watchStubPath(
                              accessUi.bestOption.primaryWatchServiceId,
                              id
                            ),
                            game_id: id,
                            label: "open_watch_best_option",
                            provider_hint: accessUi.bestOption.provider.split(" ")[0],
                            ...(accessUi.bestOption.primaryWatchServiceId
                              ? { plan_id: accessUi.bestOption.primaryWatchServiceId }
                              : {}),
                          }),
                        })
                        trackEvent(AnalyticsEvent.watchActionClick, {
                          ...analyticsBase("game_detail", state, {
                            href: watchStubPath(
                              accessUi.bestOption.primaryWatchServiceId,
                              id
                            ),
                            game_id: id,
                            label: "open_watch_best_option",
                            provider_hint: accessUi.bestOption.provider.split(" ")[0],
                            ...(accessUi.bestOption.primaryWatchServiceId
                              ? { plan_id: accessUi.bestOption.primaryWatchServiceId }
                              : {}),
                          }),
                        })
                      }}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      {watchOpenButtonLabel(accessUi.bestOption.primaryWatchServiceId)}
                    </Link>
                  </Button>
                )}
                <Link
                  href="/plans"
                  onClick={() => {
                    trackEvent(AnalyticsEvent.ctaSecondaryClick, {
                      ...analyticsBase("game_detail", state, {
                        href: "/plans",
                        label: labelReviewDetails(),
                        game_id: id,
                      }),
                    })
                    trackEvent(AnalyticsEvent.comparePlansClick, {
                      ...analyticsBase("game_detail", state, {
                        href: "/plans",
                        label: "view_plans_best_value",
                        game_id: id,
                      }),
                    })
                  }}
                >
                  <Button variant="outline">
                    <Tv className="mr-2 size-4" />
                    {labelReviewDetails()}
                  </Button>
                </Link>
                </div>
                <p className="text-center text-[11px] leading-snug text-muted-foreground">
                  {valueJustificationBestValue()}
                </p>
                <p className="text-center text-[11px] font-medium leading-snug text-foreground/75">
                  {socialProofRecommended()}
                </p>
                {accessUi.bestOption.type === "listen" && access?.fixRecommendation && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Also try: </span>
                    {access.fixRecommendation}
                    {" · "}
                    {upgradeHref ? (
                      <Link
                        href={upgradeHref}
                        className="font-medium text-accent underline-offset-2 hover:underline"
                        onClick={() => {
                          trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                            ...analyticsBase("game_detail", state, {
                              href: upgradeHref,
                              label: labelGetBestValue(),
                              game_id: id,
                            }),
                            ...(upgradeImpactId ? { upgrade_id: upgradeImpactId } : {}),
                          })
                          trackEvent(AnalyticsEvent.upgradeClick, {
                            ...analyticsBase("game_detail", state, {
                              href: upgradeHref,
                              label: "upgrade_best_value_inline",
                              game_id: id,
                            }),
                            ...(upgradeImpactId ? { upgrade_id: upgradeImpactId } : {}),
                          })
                        }}
                      >
                        {labelGetBestValue()}
                      </Link>
                    ) : (
                      <Link
                        href="/plans"
                        className="font-medium text-accent underline-offset-2 hover:underline"
                        onClick={() => {
                          trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                            ...analyticsBase("game_detail", state, {
                              href: "/plans",
                              label: labelGetBestValue(),
                              game_id: id,
                            }),
                          })
                          trackEvent(AnalyticsEvent.comparePlansClick, {
                            ...analyticsBase("game_detail", state, {
                              href: "/plans",
                              label: "upgrade_best_value_plans_fallback",
                              game_id: id,
                            }),
                          })
                        }}
                      >
                        {labelGetBestValue()}
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </section>
        )}

        {/* Watch Section */}
        {accessUi && (
        <section className="mb-6">
          <Card className="overflow-hidden border-border bg-card p-0">
            <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
              <Tv className="size-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Watch</h3>
              <div className="ml-auto">
                {accessUi.watchVerdict.canWatch ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-available/15 px-2.5 py-1 text-xs font-medium text-status-available">
                    <span className="size-1.5 rounded-full bg-status-available" />
                    Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-unavailable/15 px-2.5 py-1 text-xs font-medium text-status-unavailable">
                    <span className="size-1.5 rounded-full bg-status-unavailable" />
                    Not available with your plan
                  </span>
                )}
              </div>
            </div>
            <div className="px-4 py-3">
              <p
                className={cn(
                  "mb-2 font-medium",
                  accessUi.watchVerdict.canWatch
                    ? "text-status-available"
                    : "text-status-unavailable"
                )}
              >
                {accessUi.watchVerdict.summary}
              </p>
              <ul className="mb-4 space-y-1.5">
                {accessUi.watchVerdict.reasons.map((reason, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                    {reason}
                  </li>
                ))}
              </ul>
              <div className="divide-y divide-border/50">
                {accessUi.watchOptions.map((option, i) => (
                  <WatchOptionRow key={i} option={option} gameId={id} userState={state} />
                ))}
              </div>
              {!accessUi.watchVerdict.canWatch && access && (
                <div className="space-y-3 border-t border-border/50 bg-secondary/20 px-4 py-4">
                  <p className="text-sm font-medium text-foreground">
                    Not available with your current plan
                  </p>
                  {access.fixRecommendation && (
                    <p className="text-sm text-muted-foreground">{access.fixRecommendation}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Connect the right service or move to a bundle that includes this feed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" asChild>
                      <Link
                        href="/settings/services"
                        onClick={() =>
                          trackEvent(AnalyticsEvent.connectedServicesClick, {
                            ...analyticsBase("game_detail", state, {
                              href: "/settings/services",
                              label: "watch_section_connected",
                              game_id: id,
                            }),
                          })
                        }
                      >
                        Connected Services
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href="/plans"
                        onClick={() =>
                          trackEvent(AnalyticsEvent.comparePlansClick, {
                            ...analyticsBase("game_detail", state, {
                              href: "/plans",
                              label: "watch_section_compare",
                              game_id: id,
                            }),
                          })
                        }
                      >
                        Compare plans
                      </Link>
                    </Button>
                    {upgradeHref ? (
                      <Button size="sm" className="gap-1" asChild>
                        <Link
                          href={upgradeHref}
                          onClick={() =>
                            trackEvent(AnalyticsEvent.upgradeClick, {
                              ...analyticsBase("game_detail", state, {
                                href: upgradeHref,
                                label: "watch_section_upgrade",
                                game_id: id,
                              }),
                              ...(upgradeImpactId
                                ? { upgrade_id: upgradeImpactId }
                                : {}),
                            })
                          }
                        >
                          <Zap className="size-3.5" />
                          Upgrade to Best Value
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
        )}

        {/* Listen Section */}
        <section className="mb-6">
          <Card className="overflow-hidden border-border bg-card p-0">
            <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
              <Radio className="size-5 text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Just Listen</h3>
              <div className="ml-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-available/15 px-2.5 py-1 text-xs font-medium text-status-available">
                  <span className="size-1.5 rounded-full bg-status-available" />
                  Available
                </span>
              </div>
            </div>
            <div className="divide-y divide-border/50 px-4">
              {game.listenFeeds.map((feed, i) => (
                <ListenFeedRow key={i} feed={feed} gameId={id} userState={state} />
              ))}
            </div>
          </Card>
        </section>

        {/* Why This Answer Section */}
        <section>
          <Card className="overflow-hidden border-border bg-card/50 p-0">
            <button
              onClick={() => setShowWhyPanel(!showWhyPanel)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-card"
            >
              <Info className="size-5 text-muted-foreground" />
              <span className="flex-1 font-semibold text-foreground">
                Why this answer?
              </span>
              {showWhyPanel ? (
                <ChevronUp className="size-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-5 text-muted-foreground" />
              )}
            </button>
            {showWhyPanel && accessUi && (
              <div className="border-t border-border/50 px-4 py-4">
                <ul className="space-y-3">
                  {accessUi.whyThisAnswer.map((reason, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed text-muted-foreground">
                        {reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
