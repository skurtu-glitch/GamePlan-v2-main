"use client"

import { useEffect, useMemo, useState } from "react"
import { getEngineGames, teamsForFollowedIds } from "@/lib/data"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import {
  ScheduleHydrationSkeleton,
  useSchedule,
} from "@/components/providers/schedule-provider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Tv, 
  Radio, 
  ChevronRight,
  Info,
  Sparkles,
  Zap
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrentUserCoverageSummary } from "@/lib/current-user-coverage"
import { classifyRecommendedPlans } from "@/lib/optimizer-engine"
import {
  getAnnualCost,
  getPlansForScope,
  type OptimizerScope,
} from "@/lib/optimizer-plans"
import { formatServiceIdList } from "@/lib/streaming-service-ids"
import { getPlanBundlePromoSummary } from "@/lib/promotion-pricing"
import { PlanPromoCallout } from "@/components/plan-promo-callout"
import {
  getAffiliateLink,
  getEffectivePrice,
  hasAffiliateLanding,
  primaryAffiliateServiceIdForPlan,
} from "@/lib/affiliate"
import {
  AnalyticsEvent,
  analyticsBase,
  trackAffiliateClick,
  trackEvent,
} from "@/lib/analytics"
import {
  chooseMonetizedPrimaryLabel,
  formatBundlePlusList,
  isGameWithinHours,
  labelGetBestValue,
  labelReviewDetails,
  socialProofMostFans,
  socialProofRecommended,
  URGENCY_HOURS,
  valueJustificationBestValue,
  valueJustificationCheapest,
} from "@/lib/conversion-copy"

function optimizerRoleExplanation(
  planId: string,
  rec: ReturnType<typeof classifyRecommendedPlans>
): string | null {
  if (planId === rec.cheapestPlanId) return rec.explanations.cheapest
  if (planId === rec.bestValuePlanId) return rec.explanations.bestValue
  if (planId === rec.fullCoveragePlanId) return rec.explanations.fullCoverage
  if (planId === rec.radioPlanId) return rec.explanations.radio
  return null
}

export default function PlansPage() {
  const { state } = useDemoUser()
  const { isHydrating: isScheduleHydrating, scheduleVersion } = useSchedule()
  const [selectedTeam, setSelectedTeam] = useState<OptimizerScope>("both")
  const plans = getPlansForScope(selectedTeam)
  const recommendations = useMemo(
    () => classifyRecommendedPlans(selectedTeam, state),
    [selectedTeam, state]
  )
  const bestValuePlanId = recommendations.bestValuePlanId
  const currentCoverage = useMemo(
    () => getCurrentUserCoverageSummary(selectedTeam, state),
    [selectedTeam, state, scheduleVersion]
  )

  const monetizedPrimaryWithin24h = useMemo(() => {
    const now = new Date()
    const followed = teamsForFollowedIds(state.followedTeamIds)
    const games = getEngineGames().filter((game) =>
      followed.some(
        (team) => team.id === game.homeTeam.id || team.id === game.awayTeam.id
      )
    )
    return games.some((g) => isGameWithinHours(g.dateTime, URGENCY_HOURS, now))
  }, [state.followedTeamIds, scheduleVersion])

  useEffect(() => {
    trackEvent(AnalyticsEvent.decisionShown, {
      ...analyticsBase("plans", state, {
        surface: "plans_optimizer_list",
        scope: selectedTeam,
      }),
    })
  }, [selectedTeam, state])

  const teamLabels: Record<OptimizerScope, string> = {
    blues: "Blues Only",
    cardinals: "Cardinals Only",
    both: "Both Teams",
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur-sm">
        <h1 className="text-xl font-bold text-foreground">Plan Optimizer</h1>
        <p className="text-sm text-muted-foreground">Find the best way to follow your teams</p>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-lg px-5 py-6">
        {/* Team Selector */}
        <div className="mb-6 flex gap-2">
          {(["blues", "cardinals", "both"] as OptimizerScope[]).map((team) => (
            <button
              key={team}
              onClick={() => setSelectedTeam(team)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                selectedTeam === team
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              )}
            >
              {teamLabels[team]}
            </button>
          ))}
        </div>

        {/* Your current setup — same resolver + schedule as Home / Assistant / My Teams */}
        {isScheduleHydrating && state.connectedServiceIds.length > 0 ? (
          <div className="mb-6">
            <ScheduleHydrationSkeleton />
          </div>
        ) : (
        <Card className="mb-6 overflow-hidden border-border/50 bg-card/50 p-0">
          <div className="border-b border-border/40 bg-secondary/20 px-4 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your Current Plan
            </p>
            <p className="text-[10px] text-muted-foreground">
              Live schedule in this scope · subscriptions + market rules
            </p>
            {selectedTeam !== "both" && (
              <p className="mt-1 text-[10px] text-muted-foreground/90">
                Home always summarizes Blues + Cardinals together; this card follows your tab
                above.
              </p>
            )}
          </div>
          <div className="p-4">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {currentCoverage.coveragePercent}
                  <span className="text-lg font-semibold text-muted-foreground">%</span>
                </p>
                <p className="text-xs text-muted-foreground">Watchable coverage</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums text-foreground">
                  {currentCoverage.gamesWatchable}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {currentCoverage.totalGames}
                  </span>
                </p>
                <p className="text-[10px] text-muted-foreground">games watchable</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 text-sm">
              <Info className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Connected:</span>
              <span className="font-medium text-foreground">
                {state.connectedServiceIds.length > 0
                  ? formatServiceIdList(state.connectedServiceIds)
                  : "None — add services to see accurate coverage"}
              </span>
            </div>
            <Link
              href="/settings/services"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent"
              onClick={() =>
                trackEvent(AnalyticsEvent.connectedServicesClick, {
                  ...analyticsBase("plans", state, {
                    href: "/settings/services",
                    label: "update_connected_services",
                    scope: selectedTeam,
                  }),
                  recommended_plan_id: bestValuePlanId ?? undefined,
                })
              }
            >
              Update Connected Services
              <ChevronRight className="size-4" />
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">
              Catalog plans below use season totals for tier comparison; the card above matches your in-app schedule rows.
            </p>
          </div>
        </Card>
        )}

        {/* Plans List */}
        <div className="flex flex-col gap-5">
          {plans.map((plan) => {
            const isRadioOnly = plan.tier === "radio"
            const isLogicBestValue =
              bestValuePlanId !== null && plan.id === bestValuePlanId
            const coveragePercent = plan.coveragePercent
            const listenOnlyGames = plan.gamesListenOnly
            const watchPercent = plan.totalGames > 0 ? (plan.gamesWatchable / plan.totalGames) * 100 : 0
            const listenPercent = plan.totalGames > 0 ? (listenOnlyGames / plan.totalGames) * 100 : 0
            const roleExplanation = optimizerRoleExplanation(plan.id, recommendations)
            const bundlePromo = getPlanBundlePromoSummary(plan)
            const leadServiceId = primaryAffiliateServiceIdForPlan(plan)
            const leadPricing =
              leadServiceId && !isRadioOnly
                ? getEffectivePrice(leadServiceId)
                : null
            const startPlanHref =
              leadServiceId && hasAffiliateLanding(leadServiceId)
                ? getAffiliateLink(leadServiceId, {
                    sourceScreen: "plans",
                    intent: "plans_start_plan",
                    planId: plan.id,
                  })
                : null
            const primaryCtaLabel = chooseMonetizedPrimaryLabel({
              within24h: monetizedPrimaryWithin24h,
              planName: plan.name,
            })
            const planValueLine =
              plan.tier === "cheapest"
                ? valueJustificationCheapest()
                : valueJustificationBestValue()
            const planSocialLine =
              plan.tier === "value" || plan.name === "Best Value"
                ? socialProofMostFans()
                : socialProofRecommended()

            return (
              <Card 
                key={plan.id}
                className={cn(
                  "relative overflow-hidden border-border p-0 transition-all",
                  isLogicBestValue && "border-accent ring-1 ring-accent/30"
                )}
              >
                {/* Header Row */}
                <div className={cn(
                  "flex items-center justify-between px-5 py-3",
                  isLogicBestValue ? "bg-accent" : "border-b border-border/50 bg-secondary/30"
                )}>
                  <h3 className={cn(
                    "font-semibold",
                    isLogicBestValue ? "text-accent-foreground" : "text-foreground"
                  )}>
                    {plan.name}
                  </h3>
                  {isLogicBestValue && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
                      <Sparkles className="size-3.5" />
                      Best Value
                    </div>
                  )}
                </div>

                <div className="p-5">
                  {/* Coverage Hero */}
                  <div className="mb-5 text-center">
                    <p className={cn(
                      "text-5xl font-bold tracking-tight",
                        isRadioOnly ? "text-muted-foreground" : coveragePercent >= 90 ? "text-emerald-400" : coveragePercent >= 50 ? "text-amber-400" : coveragePercent > 0 ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {coveragePercent}%
                    </p>
                    <p className="text-sm text-muted-foreground">Coverage</p>
                    <p className="mt-1 text-base font-medium text-foreground">
                      {plan.gamesWatchable} of {plan.totalGames} games
                    </p>
                  </div>

                  {/* Coverage Bar */}
                  <div className="mb-5">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted/30">
                      {watchPercent > 0 && (
                        <div 
                          className="inline-block h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                          style={{ width: `${watchPercent}%` }}
                        />
                      )}
                      {listenPercent > 0 && (
                        <div 
                          className="inline-block h-full bg-gradient-to-r from-amber-500 to-amber-400"
                          style={{ width: `${listenPercent}%` }}
                        />
                      )}
                    </div>
                    {/* Legend */}
                    <div className="mt-2 flex justify-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-muted-foreground">Watchable</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">Listen Only</span>
                      </div>
                      {watchPercent + listenPercent < 100 && (
                        <div className="flex items-center gap-1.5">
                          <div className="size-2 rounded-full bg-muted-foreground/30" />
                          <span className="text-xs text-muted-foreground">Not available with your plan</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cost + Stats Row */}
                  <div className="mb-5 grid grid-cols-3 gap-3">
                    {/* Monthly Cost */}
                    <div className="rounded-xl bg-secondary/50 p-3 text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        List price
                      </p>
                      <p className={cn(
                        "text-xl font-bold",
                        isRadioOnly ? "text-emerald-400" : isLogicBestValue ? "text-accent" : "text-foreground"
                      )}>
                        {plan.monthlyCost === 0 ? "Free" : `$${plan.monthlyCost.toFixed(0)}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">/month</p>
                      <PlanPromoCallout summary={bundlePromo} className="mt-2 border-t border-border/30 pt-2 text-left" />
                      {leadPricing && leadPricing.listPrice > 0 && (
                        <div className="mt-2 border-t border-border/30 pt-2 text-left text-[10px] leading-snug text-muted-foreground">
                          <p className="font-medium text-foreground/90">
                            Lead service list: ${leadPricing.listPrice.toFixed(2)}/mo
                          </p>
                          {leadPricing.showPromoAdjusted ? (
                            <>
                              <p className="mt-0.5 text-emerald-600/90">
                                Promo-adjusted (est.): ${leadPricing.effectiveMonthlyPrice.toFixed(2)}/mo
                              </p>
                              <p className="mt-0.5">
                                Est. savings vs list: ~${leadPricing.estimatedSavings.toFixed(2)}/mo
                              </p>
                              {leadPricing.promoLabel && (
                                <p className="mt-0.5 italic">{leadPricing.promoLabel}</p>
                              )}
                            </>
                          ) : (
                            <p className="mt-0.5">Intro offers hidden (stale, expired, or low confidence).</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Watchable Games - Clickable */}
                    <Link
                      href={`/plans/${plan.id}`}
                      className="block"
                      onClick={() =>
                        trackEvent(AnalyticsEvent.comparePlansClick, {
                          ...analyticsBase("plans", state, {
                            href: `/plans/${plan.id}`,
                            label: "watchable_tile",
                            scope: selectedTeam,
                            plan_id: plan.id,
                          }),
                          recommended_plan_id: bestValuePlanId ?? undefined,
                        })
                      }
                    >
                      <div className="rounded-xl bg-secondary/50 p-3 text-center transition-colors hover:bg-accent/10">
                        <div className="flex items-center justify-center gap-1">
                          <Tv className="size-3 text-muted-foreground" />
                          <p className={cn(
                            "text-xl font-bold",
                            plan.gamesWatchable === 0 ? "text-muted-foreground" : "text-emerald-400"
                          )}>
                            {plan.gamesWatchable}
                          </p>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Watchable</p>
                      </div>
                    </Link>
                    
                    {/* Listen Only Games */}
                    <div className="rounded-xl bg-secondary/50 p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Radio className="size-3 text-muted-foreground" />
                        <p className="text-xl font-bold text-amber-400">{listenOnlyGames}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Listen Only</p>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground">
                      Includes:{" "}
                      <span className="font-medium text-foreground">
                        {formatBundlePlusList(plan.servicesIncluded)}
                      </span>
                    </p>
                  </div>

                  {roleExplanation && (
                    <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                      {roleExplanation}
                    </p>
                  )}
                  {/* Explanation */}
                  <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                    {plan.explanation}
                  </p>

                  {/* Actions */}
                  <div className="flex flex-col gap-3">
                    {!isRadioOnly && startPlanHref && leadServiceId && (
                      <a
                        href={startPlanHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                        onClick={() => {
                          trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                            ...analyticsBase("plans", state, {
                              label: primaryCtaLabel,
                              plan_id: plan.id,
                              service_id: leadServiceId,
                              intent: "plans_start_plan",
                              scope: selectedTeam,
                            }),
                            recommended_plan_id: bestValuePlanId ?? undefined,
                          })
                          trackAffiliateClick(startPlanHref, "plans", state, {
                            label: "start_plan",
                            plan_id: plan.id,
                            service_id: leadServiceId,
                            intent: "plans_start_plan",
                            scope: selectedTeam,
                          })
                        }}
                      >
                        <Button className="w-full justify-between gap-2 font-semibold">
                          <span>{primaryCtaLabel}</span>
                          <ChevronRight className="size-4 shrink-0" />
                        </Button>
                      </a>
                    )}
                    {!isRadioOnly && startPlanHref && leadServiceId && (
                      <>
                        <p className="text-center text-[11px] leading-snug text-muted-foreground">
                          {planValueLine}
                        </p>
                        <p className="text-center text-[11px] font-medium leading-snug text-foreground/75">
                          {planSocialLine}
                        </p>
                      </>
                    )}
                    <Link
                      href={`/plans/${plan.id}`}
                      className="block"
                      onClick={() => {
                        trackEvent(AnalyticsEvent.ctaSecondaryClick, {
                          ...analyticsBase("plans", state, {
                            href: `/plans/${plan.id}`,
                            label: labelReviewDetails(),
                            scope: selectedTeam,
                            plan_id: plan.id,
                          }),
                          recommended_plan_id: bestValuePlanId ?? undefined,
                        })
                        trackEvent(AnalyticsEvent.comparePlansClick, {
                          ...analyticsBase("plans", state, {
                            href: `/plans/${plan.id}`,
                            label: "view_details",
                            scope: selectedTeam,
                            plan_id: plan.id,
                          }),
                          recommended_plan_id: bestValuePlanId ?? undefined,
                        })
                      }}
                    >
                      <Button variant="outline" className="w-full justify-between">
                        <span>{labelReviewDetails()}</span>
                        <ChevronRight className="size-4" />
                      </Button>
                    </Link>

                    {plan.tier !== "full" && plan.tier !== "radio" && (
                      <Link
                        href={`/plans/upgrade/${selectedTeam === "blues" ? "blues" : selectedTeam === "cardinals" ? "cards" : "both"}-${plan.tier === "cheapest" ? "cheap-to-value" : "value-to-full"}`}
                        className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 transition-colors hover:bg-accent/10"
                        onClick={() => {
                          const upgradeId = `${selectedTeam === "blues" ? "blues" : selectedTeam === "cardinals" ? "cards" : "both"}-${plan.tier === "cheapest" ? "cheap-to-value" : "value-to-full"}`
                          trackEvent(AnalyticsEvent.ctaPrimaryClick, {
                            ...analyticsBase("plans", state, {
                              href: `/plans/upgrade/${upgradeId}`,
                              label: labelGetBestValue(),
                              scope: selectedTeam,
                              plan_id: plan.id,
                            }),
                            upgrade_id: upgradeId,
                            recommended_plan_id: bestValuePlanId ?? undefined,
                          })
                          trackEvent(AnalyticsEvent.upgradeClick, {
                            ...analyticsBase("plans", state, {
                              href: `/plans/upgrade/${upgradeId}`,
                              label: "see_upgrade_impact",
                              scope: selectedTeam,
                              plan_id: plan.id,
                            }),
                            upgrade_id: upgradeId,
                            recommended_plan_id: bestValuePlanId ?? undefined,
                          })
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="size-4 text-accent" />
                          <span className="text-sm font-medium text-foreground">
                            {labelGetBestValue()}
                          </span>
                        </div>
                        <ChevronRight className="size-4 text-accent" />
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Annual Cost Comparison */}
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Annual Cost Comparison
          </h2>
          <p className="mb-4 text-[10px] text-muted-foreground">
            Based on list price × 12; check each plan card for eligible intro offers.
          </p>
          <Card className="border-border/50 p-4">
            <div className="space-y-3">
              {plans.filter(p => p.tier !== "radio").map((plan) => {
                const annual = getAnnualCost(plan)
                const annualCosts = plans.filter(p => p.tier !== "radio").map(getAnnualCost)
                const maxCost = Math.max(...annualCosts, 1)
                const width = maxCost > 0 ? (annual / maxCost) * 100 : 0
                
                return (
                  <div key={plan.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{plan.name}</span>
                      <span className="font-medium text-foreground">${annual.toFixed(0)}/yr</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          bestValuePlanId !== null && plan.id === bestValuePlanId
                            ? "bg-accent"
                            : "bg-muted-foreground/50"
                        )}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
