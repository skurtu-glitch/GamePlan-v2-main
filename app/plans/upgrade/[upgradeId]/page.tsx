"use client"

import { use, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BottomNav } from "@/components/bottom-nav"
import { SoftAuthValuePrompt } from "@/components/soft-auth-value-prompt"
import {
  ArrowLeft,
  ArrowRight,
  Tv,
  Radio,
  ChevronRight,
  Zap,
  Sparkles,
  Plus,
  Check,
  TrendingUp,
} from "lucide-react"
import { getUpgradeImpact, getUpgradeImpactStats } from "@/lib/upgrade-impact"
import { getOptimizerPlanById } from "@/lib/optimizer-plans"
import { getPlanBundlePromoSummary } from "@/lib/promotion-pricing"
import { PlanPromoCallout } from "@/components/plan-promo-callout"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import {
  getAffiliateLink,
  getBestOffer,
  getEffectivePrice,
  hasAffiliateLanding,
  primaryAffiliateServiceIdForPlan,
} from "@/lib/affiliate"
import { formatServiceIdList } from "@/lib/streaming-service-ids"
import {
  AnalyticsEvent,
  analyticsBase,
  trackAffiliateClick,
  trackEvent,
} from "@/lib/analytics"
import { classifyRecommendedPlans } from "@/lib/optimizer-engine"
import { getEngineGames, teamsForFollowedIds } from "@/lib/data"
import {
  chooseMonetizedPrimaryLabel,
  formatBundlePlusList,
  formatUpgradeBeforeAfterWatchableLines,
  isGameWithinHours,
  labelReviewDetails,
  socialProofMostFans,
  socialProofRecommended,
  upgradeAboutMonthlyMoreLine,
  upgradeCostPerAdditionalGameLine,
  upgradeCostPerGameCompactLine,
  upgradePrimaryWatchMoreGames,
  upgradeSecondaryFullSeason,
  upgradeUnlockAdditionalGamesSeason,
  URGENCY_HOURS,
  valueJustificationBestValue,
  valueJustificationCheapest,
} from "@/lib/conversion-copy"
import type { OptimizerScope } from "@/lib/optimizer-plans"
import { consumeSoftAuthNavMoment } from "@/lib/soft-auth-prompt"
import { cn } from "@/lib/utils"

function scopeFromPlanId(planId: string): OptimizerScope {
  if (planId.startsWith("blues")) return "blues"
  if (planId.startsWith("cardinals")) return "cardinals"
  return "both"
}

export default function UpgradeImpactPage({ params }: { params: Promise<{ upgradeId: string }> }) {
  const { upgradeId } = use(params)
  const router = useRouter()
  const { state } = useDemoUser()

  useEffect(() => {
    consumeSoftAuthNavMoment("plans")
  }, [])

  const upgrade = getUpgradeImpact(upgradeId, state)

  const stats = useMemo(
    () => (upgrade ? getUpgradeImpactStats(upgrade) : null),
    [upgrade]
  )

  const fromPlan = useMemo(
    () => (upgrade ? getOptimizerPlanById(upgrade.fromPlanId) : null),
    [upgrade]
  )
  const toPlan = useMemo(
    () => (upgrade ? getOptimizerPlanById(upgrade.toPlanId) : null),
    [upgrade]
  )

  const scope: OptimizerScope = upgrade
    ? scopeFromPlanId(upgrade.toPlanId)
    : "both"

  const recs = useMemo(
    () => classifyRecommendedPlans(scope, state),
    [scope, state]
  )

  const monetizedPrimaryWithin24h = useMemo(() => {
    const t = new Date()
    const followed = teamsForFollowedIds(state.followedTeamIds)
    const games = getEngineGames().filter((game) =>
      followed.some(
        (tm) => tm.id === game.homeTeam.id || tm.id === game.awayTeam.id
      )
    )
    return games.some((g) => isGameWithinHours(g.dateTime, URGENCY_HOURS, t))
  }, [state.followedTeamIds])

  const primaryCtaLabel = useMemo(
    () =>
      toPlan
        ? chooseMonetizedPrimaryLabel({
            within24h: monetizedPrimaryWithin24h,
            planName: toPlan.name,
          })
        : "Unlock more games",
    [toPlan, monetizedPrimaryWithin24h]
  )

  const upgradeDecisionHeadline = useMemo(() => {
    if (!upgrade || !stats || !toPlan) return ""
    if (stats.newlyWatchable > 0) {
      return upgradePrimaryWatchMoreGames(stats.newlyWatchable)
    }
    return `Move to ${upgrade.toPlanName} on the season catalog`
  }, [upgrade, stats, toPlan])

  const upgradeWhyBullets = useMemo(() => {
    if (!upgrade || !stats || !toPlan) return [] as string[]
    const { before, after } = formatUpgradeBeforeAfterWatchableLines(
      stats.catalogCurrentWatchable,
      stats.catalogUpgradedWatchable
    )
    const bullets: string[] = [`${before}. ${after}.`]
    if (stats.newlyWatchable > 0) {
      bullets.push(
        `${upgradeUnlockAdditionalGamesSeason(stats.newlyWatchable)} ${upgradeSecondaryFullSeason()}.`
      )
    }
    if (
      bullets.length < 2 &&
      toPlan.tier !== "full" &&
      recs.fullCoveragePlanId != null &&
      recs.fullCoveragePlanId !== upgrade.toPlanId
    ) {
      bullets.push(
        "Avoid paying for full coverage—this upgrade lands most of the season."
      )
    } else if (bullets.length < 2 && stats.newlyWatchable > 0) {
      bullets.push(
        `About +$${stats.costDelta.toFixed(2)}/mo list price for this catalog step.`
      )
    }
    return bullets.slice(0, 2)
  }, [upgrade, stats, toPlan, recs.fullCoveragePlanId])

  const planValueLine = useMemo(() => {
    if (!toPlan) return ""
    return toPlan.tier === "cheapest"
      ? valueJustificationCheapest()
      : valueJustificationBestValue()
  }, [toPlan])

  const planSocialLine = useMemo(() => {
    if (!toPlan) return ""
    return toPlan.tier === "value" || toPlan.name === "Best Value"
      ? socialProofMostFans()
      : socialProofRecommended()
  }, [toPlan])

  const fromBundlePromo = useMemo(
    () => (fromPlan ? getPlanBundlePromoSummary(fromPlan) : null),
    [fromPlan]
  )
  const upgradedBundlePromo = useMemo(
    () => (toPlan ? getPlanBundlePromoSummary(toPlan) : null),
    [toPlan]
  )

  const introUpgradeStepMo = useMemo(() => {
    if (
      !upgradedBundlePromo?.showPromoLine ||
      upgradedBundlePromo.introEffectiveMonthlyUsd === undefined ||
      !fromPlan
    ) {
      return null
    }
    return (
      Math.round(
        (upgradedBundlePromo.introEffectiveMonthlyUsd - fromPlan.monthlyCost) * 100
      ) / 100
    )
  }, [upgradedBundlePromo, fromPlan])

  const stickyLeadId =
    toPlan && toPlan.tier !== "radio"
      ? primaryAffiliateServiceIdForPlan(toPlan)
      : undefined
  const stickyAffiliateHref =
    upgrade &&
    stickyLeadId &&
    hasAffiliateLanding(stickyLeadId)
      ? getAffiliateLink(stickyLeadId, {
          sourceScreen: "upgrade_impact",
          intent: "upgrade_sticky_start",
          planId: upgrade.toPlanId,
        })
      : null
  const stickyHref =
    upgrade && stickyAffiliateHref
      ? stickyAffiliateHref
      : upgrade
        ? `/plans/${upgrade.toPlanId}`
        : "/plans"
  const stickyOffer = stickyLeadId ? getBestOffer(stickyLeadId) : null
  const stickyPrice = stickyLeadId ? getEffectivePrice(stickyLeadId) : null

  useEffect(() => {
    if (!upgrade || !stats) return
    trackEvent(AnalyticsEvent.decisionShown, {
      ...analyticsBase("upgrade_impact", state, {
        surface: "upgrade_impact_conversion",
        upgrade_id: upgradeId,
        plan_id: upgrade.toPlanId,
        scope,
      }),
      recommended_plan_id: recs.bestValuePlanId ?? undefined,
    })
  }, [upgrade, stats, upgradeId, state, recs.bestValuePlanId, scope])

  const onUpgradeStickyPrimaryClick = useCallback(() => {
    if (!upgrade || !toPlan) return
    if (stickyAffiliateHref && stickyLeadId) {
      trackEvent(AnalyticsEvent.ctaPrimaryClick, {
        ...analyticsBase("upgrade_impact", state, {
          label: primaryCtaLabel,
          plan_id: upgrade.toPlanId,
          service_id: stickyLeadId,
          intent: "upgrade_sticky_start",
          href: stickyHref,
          scope,
          upgrade_id: upgradeId,
        }),
        recommended_plan_id: recs.bestValuePlanId ?? undefined,
      })
      return
    }
    trackEvent(AnalyticsEvent.ctaPrimaryClick, {
      ...analyticsBase("upgrade_impact", state, {
        label: primaryCtaLabel,
        plan_id: upgrade.toPlanId,
        href: stickyHref,
        scope,
        upgrade_id: upgradeId,
      }),
      recommended_plan_id: recs.bestValuePlanId ?? undefined,
    })
  }, [
    upgrade,
    toPlan,
    stickyAffiliateHref,
    stickyLeadId,
    state,
    primaryCtaLabel,
    stickyHref,
    scope,
    upgradeId,
    recs.bestValuePlanId,
  ])

  if (!upgrade || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Upgrade not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/plans")}>
            Back to Plans
          </Button>
        </div>
      </div>
    )
  }

  const currentPercentage = stats.catalogCurrentPercent
  const upgradedPercentage = stats.catalogUpgradedPercent
  const catalogTotal = stats.catalogTotalGames

  return (
    <div className="flex min-h-screen flex-col bg-background pb-40">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <Zap className="size-4 text-accent" />
              <h1 className="text-lg font-bold text-foreground">Upgrade Impact</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              {upgrade.fromPlanName} <ArrowRight className="inline size-3" /> {upgrade.toPlanName}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-lg px-5 py-6">
        <Card className="mb-6 overflow-hidden border-accent/30 bg-gradient-to-r from-accent/10 to-transparent p-0">
          <div className="border-b border-border/40 bg-secondary/15 px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Decision
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-snug text-foreground">
                {upgradeDecisionHeadline}
              </p>
              {stats.newlyWatchable > 0 && upgradeCostPerGameCompactLine(stats.costPerNewGame) && (
                <p className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400/95">
                  {upgradeCostPerGameCompactLine(stats.costPerNewGame)}
                </p>
              )}
              {upgradeAboutMonthlyMoreLine(stats.costDelta) && (
                <p className="text-xs text-muted-foreground">
                  {upgradeAboutMonthlyMoreLine(stats.costDelta)}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Why
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                {upgradeWhyBullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Next
              </p>
              {toPlan && (
                <p className="mt-2 text-[11px] font-medium leading-snug text-foreground/90">
                  <span className="text-muted-foreground">Includes: </span>
                  {formatBundlePlusList(toPlan.servicesIncluded)}
                </p>
              )}
              {toPlan && toPlan.tier !== "radio" && (
                <>
                  <Button className="mt-3 w-full gap-2 font-semibold" size="lg" asChild>
                    <a
                      href={stickyHref}
                      target={stickyAffiliateHref ? "_blank" : undefined}
                      rel={stickyAffiliateHref ? "noopener noreferrer" : undefined}
                      onClick={() => {
                        onUpgradeStickyPrimaryClick()
                        if (stickyAffiliateHref && stickyLeadId) {
                          trackAffiliateClick(stickyAffiliateHref, "upgrade_impact", state, {
                            label: "upgrade_inline_start",
                            plan_id: upgrade.toPlanId,
                            service_id: stickyLeadId,
                            intent: "upgrade_inline_start",
                            scope,
                            upgrade_id: upgradeId,
                            recommended_plan_id: recs.bestValuePlanId ?? undefined,
                          })
                          return
                        }
                        trackEvent(AnalyticsEvent.upgradeClick, {
                          ...analyticsBase("upgrade_impact", state, {
                            href: stickyHref,
                            label: "upgrade_inline_cta",
                            scope,
                            plan_id: upgrade.toPlanId,
                          }),
                          upgrade_id: upgradeId,
                          recommended_plan_id: recs.bestValuePlanId ?? undefined,
                        })
                      }}
                    >
                      {primaryCtaLabel}
                      <ChevronRight className="size-4" />
                    </a>
                  </Button>
                  <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
                    {planValueLine}
                  </p>
                  <p className="text-center text-[11px] font-medium leading-snug text-foreground/75">
                    {planSocialLine}
                  </p>
                </>
              )}
              <Link
                href={`/plans/${upgrade.toPlanId}`}
                className="mt-2 block"
                onClick={() => {
                  trackEvent(AnalyticsEvent.ctaSecondaryClick, {
                    ...analyticsBase("upgrade_impact", state, {
                      href: `/plans/${upgrade.toPlanId}`,
                      label: labelReviewDetails(),
                      scope,
                      plan_id: upgrade.toPlanId,
                    }),
                    upgrade_id: upgradeId,
                    recommended_plan_id: recs.bestValuePlanId ?? undefined,
                  })
                  trackEvent(AnalyticsEvent.comparePlansClick, {
                    ...analyticsBase("upgrade_impact", state, {
                      href: `/plans/${upgrade.toPlanId}`,
                      label: "view_full_plan_details",
                      scope,
                      plan_id: upgrade.toPlanId,
                    }),
                    upgrade_id: upgradeId,
                    recommended_plan_id: recs.bestValuePlanId ?? undefined,
                  })
                }}
              >
                <Button
                  variant="ghost"
                  className="h-9 w-full gap-1.5 text-xs font-medium text-muted-foreground"
                >
                  {labelReviewDetails()}
                  <ChevronRight className="size-3.5 opacity-70" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        
        {/* Before vs After Comparison — catalog season totals (same basis as Plan Optimizer) */}
        <section className="mb-6">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Season catalog (Plan Optimizer basis)
          </p>
          {/* Current Plan */}
          <Card className="mb-3 overflow-hidden border-border bg-secondary/20 p-0">
            <div className="border-b border-border/50 bg-secondary/30 px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Current Plan
              </p>
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-base font-semibold text-muted-foreground">{upgrade.fromPlanName}</span>
                <span className="text-2xl font-bold text-muted-foreground">{currentPercentage}%</span>
              </div>
              <p className="mb-2 text-xs leading-snug text-muted-foreground">
                {
                  formatUpgradeBeforeAfterWatchableLines(
                    stats.catalogCurrentWatchable,
                    stats.catalogUpgradedWatchable
                  ).before
                }
              </p>
              {/* Coverage bar - muted */}
              <div className="mb-2 h-3 overflow-hidden rounded-full bg-muted/30">
                <div 
                  className="h-full rounded-full bg-muted-foreground/40 transition-all"
                  style={{ width: `${currentPercentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.catalogCurrentWatchable} of {catalogTotal} games watchable
              </p>
              {fromPlan && fromPlan.monthlyCost > 0 && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  List price: ${fromPlan.monthlyCost.toFixed(2)}/mo
                </p>
              )}
              {fromBundlePromo?.showPromoLine && (
                <div className="mt-2 border-t border-border/40 pt-2">
                  <PlanPromoCallout summary={fromBundlePromo} />
                </div>
              )}
            </div>
          </Card>

          {/* Arrow */}
          <div className="flex justify-center py-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent/20">
              <TrendingUp className="size-5 text-accent" />
            </div>
          </div>

          {/* Upgraded Plan */}
          <Card className="overflow-hidden border-emerald-500/30 bg-emerald-500/5 p-0">
            <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">Upgraded Plan</p>
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-base font-semibold text-foreground">{upgrade.toPlanName}</span>
                <span className="text-2xl font-bold text-emerald-400">{upgradedPercentage}%</span>
              </div>
              <p className="mb-2 text-xs leading-snug text-emerald-400/85">
                {
                  formatUpgradeBeforeAfterWatchableLines(
                    stats.catalogCurrentWatchable,
                    stats.catalogUpgradedWatchable
                  ).after
                }
              </p>
              {/* Coverage bar - green */}
              <div className="mb-2 h-3 overflow-hidden rounded-full bg-emerald-500/20">
                <div 
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${upgradedPercentage}%` }}
                />
              </div>
              <p className="text-xs text-emerald-400/80">
                {stats.catalogUpgradedWatchable} of {catalogTotal} games watchable
              </p>
              {toPlan && toPlan.monthlyCost > 0 && (
                <p className="mt-2 text-[10px] text-emerald-400/80">
                  List price: ${toPlan.monthlyCost.toFixed(2)}/mo
                </p>
              )}
            </div>
          </Card>
        </section>

        {/* Delta Highlight — season catalog */}
        <Card className="mb-6 overflow-hidden border-accent/30 bg-gradient-to-br from-accent/10 to-emerald-500/5 p-0">
          <div className="p-5">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Season catalog (full season)
            </p>
            <div className="flex items-center justify-between">
              {/* Games gained */}
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/20">
                  <Sparkles className="size-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-400">+{stats.newlyWatchable}</p>
                  {stats.newlyWatchable > 0 && (
                    <p className="text-xs font-semibold leading-snug text-foreground/90">
                      {upgradePrimaryWatchMoreGames(stats.newlyWatchable)}
                    </p>
                  )}
                  {upgradeCostPerAdditionalGameLine(stats.costPerNewGame) && (
                    <p className="mt-0.5 text-xs font-medium tabular-nums text-emerald-600 dark:text-emerald-400/95">
                      {upgradeCostPerAdditionalGameLine(stats.costPerNewGame)}
                    </p>
                  )}
                  {upgradeAboutMonthlyMoreLine(stats.costDelta) && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {upgradeAboutMonthlyMoreLine(stats.costDelta)}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{upgradeSecondaryFullSeason()}</p>
                </div>
              </div>
              
              {/* Cost increase */}
              <div className="text-right">
                <p className="text-xl font-bold text-accent">+${stats.costDelta.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">list price / mo</p>
              </div>
            </div>
          </div>
        </Card>

        {upgradedBundlePromo?.showPromoLine && (
          <Card className="mb-6 overflow-hidden border-border/60 bg-card/40 p-0">
            <div className="px-4 py-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Upgraded plan — offers (when fresh / confident)
              </p>
              <p className="mb-2 text-[10px] text-muted-foreground">
                List{" "}
                {toPlan && toPlan.monthlyCost > 0
                  ? `$${toPlan.monthlyCost.toFixed(2)}/mo`
                  : "—"}
                {" "}
                · intro estimate below when eligible
              </p>
              <PlanPromoCallout summary={upgradedBundlePromo} />
              {introUpgradeStepMo !== null && (
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  {`With offers, estimated upgrade step: ~+$${introUpgradeStepMo.toFixed(2)}/mo avg. (list price step +$${stats.costDelta.toFixed(2)}/mo)`}
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Services Added */}
        <section className="mb-6">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Services Added
          </h3>
          <Card className="overflow-hidden border-accent/20 p-0">
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent/20">
                <Plus className="size-5 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{upgrade.addedService}</p>
                <p className="text-xs text-muted-foreground">{upgrade.addedServicePrice}</p>
              </div>
              <Check className="size-5 text-emerald-400" />
            </div>
          </Card>
        </section>

        {/* Example matchups (illustrative list; headline count is season catalog) */}
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Example games that become watchable
          </h3>
          {upgrade.unlockedGames.length > 0 && (
            <p className="mb-3 text-xs text-muted-foreground">
              Showing {upgrade.unlockedGames.length} example matchup
              {upgrade.unlockedGames.length === 1 ? "" : "s"} — see Plan Details for the full list view.
            </p>
          )}
          <div className="mt-1 flex flex-col gap-2">
            {upgrade.unlockedGames.map((game) => (
              <Card key={game.id} className="overflow-hidden border-emerald-500/20 bg-card p-0">
                <div className="p-3">
                  {/* Matchup row */}
                  <div className="mb-2 flex items-center gap-3">
                    {/* Team badge */}
                    <div
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                      style={{ backgroundColor: game.sport === "NHL" ? "#002F87" : "#C41E3A" }}
                    >
                      {game.sport}
                    </div>

                    {/* Game info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{game.matchup}</p>
                      <p className="text-xs text-muted-foreground">{game.date} &middot; {game.time}</p>
                    </div>
                  </div>

                  {/* Status change row */}
                  <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* Before status */}
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        game.beforeStatus === "listen-only" 
                          ? "bg-amber-500/15 text-amber-400" 
                          : "bg-red-500/15 text-red-400"
                      )}>
                        {game.beforeStatus === "listen-only" ? "Listen Only" : "Not available with your plan"}
                      </span>
                      
                      <ArrowRight className="size-3 text-muted-foreground" />
                      
                      {/* After status */}
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Watchable
                      </span>
                    </div>

                    {/* Provider */}
                    <span className="text-xs text-muted-foreground">
                      {game.newProvider}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          Add the right services first, then lock in this bundle so tonight’s games and the rest of the
          season line up.
        </p>
      </main>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 pb-20 pt-4 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          {toPlan && (
            <p className="mb-2 text-center text-[10px] text-muted-foreground">
              Includes:{" "}
              <span className="font-medium text-foreground">
                {formatServiceIdList(toPlan.servicesIncluded)}
              </span>
            </p>
          )}
          {stickyOffer && stickyOffer.type !== "none" && stickyPrice && stickyPrice.listPrice > 0 && (
            <p className="mb-2 text-center text-[10px] leading-snug text-muted-foreground">
              Promo highlight:{" "}
              {stickyOffer.type === "free_months"
                ? `${stickyOffer.value ?? ""} free mo`
                : stickyOffer.type === "discount"
                  ? "Intro discount"
                  : "Offer"}{" "}
              · list ${stickyPrice.listPrice.toFixed(2)}/mo
              {stickyPrice.showPromoAdjusted
                ? ` → est. $${stickyPrice.effectiveMonthlyPrice.toFixed(2)}/mo`
                : ""}
            </p>
          )}
          <Button className="w-full gap-2" size="lg" asChild>
            <a
              href={stickyHref}
              target={stickyAffiliateHref ? "_blank" : undefined}
              rel={stickyAffiliateHref ? "noopener noreferrer" : undefined}
              className="flex w-full items-center justify-center gap-2"
              onClick={() => {
                onUpgradeStickyPrimaryClick()
                if (stickyAffiliateHref && stickyLeadId) {
                  trackAffiliateClick(stickyAffiliateHref, "upgrade_impact", state, {
                    label: "start_best_value_plan",
                    plan_id: upgrade.toPlanId,
                    service_id: stickyLeadId,
                    intent: "upgrade_sticky_start",
                    scope,
                    upgrade_id: upgradeId,
                    recommended_plan_id: recs.bestValuePlanId ?? undefined,
                  })
                  return
                }
                trackEvent(AnalyticsEvent.upgradeClick, {
                  ...analyticsBase("upgrade_impact", state, {
                    href: stickyHref,
                    label: "upgrade_sticky_cta",
                    scope,
                    plan_id: upgrade.toPlanId,
                  }),
                  upgrade_id: upgradeId,
                  recommended_plan_id: recs.bestValuePlanId ?? undefined,
                })
              }}
            >
              {primaryCtaLabel}
              <ChevronRight className="size-4" />
            </a>
          </Button>
          <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
            {planValueLine}
          </p>
          <p className="text-center text-[11px] font-medium leading-snug text-foreground/75">
            {planSocialLine}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-3">
        <SoftAuthValuePrompt surface="plans" when={true} />
      </div>

      <BottomNav />
    </div>
  )
}
