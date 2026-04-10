"use client"

import { use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BottomNav } from "@/components/bottom-nav"
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
import type { OptimizerScope } from "@/lib/optimizer-plans"
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

  const upgrade = getUpgradeImpact(upgradeId)
  
  if (!upgrade) {
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

  const stats = getUpgradeImpactStats(upgrade)
  const currentPercentage = stats.catalogCurrentPercent
  const upgradedPercentage = stats.catalogUpgradedPercent
  const catalogTotal = stats.catalogTotalGames

  const fromPlan = getOptimizerPlanById(upgrade.fromPlanId)
  const toPlan = getOptimizerPlanById(upgrade.toPlanId)
  const scope = scopeFromPlanId(upgrade.toPlanId)
  const recs = classifyRecommendedPlans(scope, state)
  const fromBundlePromo = fromPlan ? getPlanBundlePromoSummary(fromPlan) : null
  const upgradedBundlePromo = toPlan ? getPlanBundlePromoSummary(toPlan) : null
  const introUpgradeStepMo =
    upgradedBundlePromo?.showPromoLine &&
    upgradedBundlePromo.introEffectiveMonthlyUsd !== undefined &&
    fromPlan
      ? Math.round((upgradedBundlePromo.introEffectiveMonthlyUsd - fromPlan.monthlyCost) * 100) / 100
      : null

  const stickyLeadId =
    toPlan && toPlan.tier !== "radio"
      ? primaryAffiliateServiceIdForPlan(toPlan)
      : undefined
  const stickyAffiliateHref =
    stickyLeadId && hasAffiliateLanding(stickyLeadId)
      ? getAffiliateLink(stickyLeadId, {
          sourceScreen: "upgrade_impact",
          intent: "upgrade_sticky_start",
          planId: upgrade.toPlanId,
        })
      : null
  const stickyHref = stickyAffiliateHref ?? `/plans/${upgrade.toPlanId}`
  const stickyOffer = stickyLeadId ? getBestOffer(stickyLeadId) : null
  const stickyPrice = stickyLeadId ? getEffectivePrice(stickyLeadId) : null

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
              This season
            </p>
            <div className="flex items-center justify-between">
              {/* Games gained */}
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/20">
                  <Sparkles className="size-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-400">+{stats.newlyWatchable}</p>
                  <p className="text-xs text-muted-foreground">more watchable games</p>
                </div>
              </div>
              
              {/* Cost increase */}
              <div className="text-right">
                <p className="text-xl font-bold text-accent">+${stats.costDelta.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">per month</p>
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

        {/* Value Framing */}
        <Card className="mb-6 overflow-hidden border-border p-0">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-sm text-muted-foreground">Cost per newly unlocked game</span>
            <span className="text-xl font-bold text-foreground">
              ~${stats.costPerNewGame.toFixed(2)}
            </span>
          </div>
        </Card>

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

        {/* Secondary CTA */}
        <Link
          href={`/plans/${upgrade.toPlanId}`}
          onClick={() =>
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
          }
        >
          <Button variant="outline" className="w-full gap-2">
            View Full Plan Details
            <ChevronRight className="size-4" />
          </Button>
        </Link>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Video not on your current plan? Add services first, then pick a bundle that includes them.
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
              <Check className="size-5" />
              Start {upgrade.toPlanName} plan
            </a>
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            +${stats.costDelta.toFixed(2)}/mo list · +{stats.newlyWatchable} more watchable this season
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
