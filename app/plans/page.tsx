"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
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
import { classifyRecommendedPlans } from "@/lib/optimizer-engine"
import {
  getAnnualCost,
  getPlansForScope,
  type OptimizerScope,
} from "@/lib/optimizer-plans"
import { formatServiceIdList } from "@/lib/streaming-service-ids"
import { getPlanBundlePromoSummary } from "@/lib/promotion-pricing"
import { PlanPromoCallout } from "@/components/plan-promo-callout"

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
  const [selectedTeam, setSelectedTeam] = useState<OptimizerScope>("both")
  const plans = getPlansForScope(selectedTeam)
  const recommendations = useMemo(
    () => classifyRecommendedPlans(selectedTeam, state),
    [selectedTeam, state]
  )
  const bestValuePlanId = recommendations.bestValuePlanId

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

        {/* Current Setup Info */}
        <Card className="mb-6 border-border/50 bg-card/50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Info className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Your connected services:</span>
            <span className="font-medium text-foreground">
              {state.connectedServiceIds.length > 0
                ? formatServiceIdList(state.connectedServiceIds)
                : "None — add services to see accurate coverage"}
            </span>
          </div>
          <Link
            href="/settings/services"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent"
          >
            Update Connected Services
            <ChevronRight className="size-4" />
          </Link>
          <p className="mt-2 text-xs text-muted-foreground">
            If video is not available with your current plan, compare bundles below or add a service first.
          </p>
        </Card>

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
                      Best Option
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
                      <p className={cn(
                        "text-xl font-bold",
                        isRadioOnly ? "text-emerald-400" : isLogicBestValue ? "text-accent" : "text-foreground"
                      )}>
                        {plan.monthlyCost === 0 ? "Free" : `$${plan.monthlyCost.toFixed(0)}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">/month</p>
                      <PlanPromoCallout summary={bundlePromo} className="mt-2 border-t border-border/30 pt-2 text-left" />
                    </div>
                    
                    {/* Watchable Games - Clickable */}
                    <Link href={`/plans/${plan.id}`} className="block">
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
                      Includes: <span className="font-medium text-foreground">{formatServiceIdList(plan.servicesIncluded)}</span>
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
                    {/* View Details */}
                    <Link href={`/plans/${plan.id}`} className="block">
                      <Button variant="outline" className="w-full justify-between">
                        <span>View Details</span>
                        <ChevronRight className="size-4" />
                      </Button>
                    </Link>

                    {/* Upgrade Impact - for non-full, non-radio plans */}
                    {plan.tier !== "full" && plan.tier !== "radio" && (
                      <Link 
                        href={`/plans/upgrade/${selectedTeam === "blues" ? "blues" : selectedTeam === "cardinals" ? "cards" : "both"}-${plan.tier === "cheapest" ? "cheap-to-value" : "value-to-full"}`}
                        className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 transition-colors hover:bg-accent/10"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="size-4 text-accent" />
                          <span className="text-sm font-medium text-foreground">See Upgrade Impact</span>
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
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Annual Cost Comparison
          </h2>
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
