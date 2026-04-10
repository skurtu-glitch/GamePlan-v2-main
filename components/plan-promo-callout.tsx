"use client"

import type { PlanBundlePromoSummary } from "@/lib/promotion-pricing"

export function PlanPromoCallout({
  summary,
  className,
}: {
  summary: PlanBundlePromoSummary
  className?: string
}) {
  if (!summary.showPromoLine || !summary.withOffersLine) return null

  return (
    <div className={className}>
      <p className="text-[11px] font-medium leading-snug text-accent">{summary.withOffersLine}</p>
      {summary.promoReframeLine && (
        <p className="mt-0.5 text-[10px] font-medium leading-snug text-foreground/90">
          {summary.promoReframeLine}
        </p>
      )}
      {summary.savingsLine && !summary.promoReframeLine && (
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{summary.savingsLine}</p>
      )}
      {summary.attributionLine && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{summary.attributionLine}</p>
      )}
      {summary.freshnessLine && (
        <p className="mt-0.5 text-[10px] text-muted-foreground/80">{summary.freshnessLine}</p>
      )}
    </div>
  )
}
