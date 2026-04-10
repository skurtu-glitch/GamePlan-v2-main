/**
 * Effective intro / promo-adjusted monthly estimates from mock {@link Promotion} data.
 * Always preserves {@link PromotionPricingResult.baseMonthlyPriceUsd}; never overrides base when
 * {@link PromotionPricingResult.shouldDisplayPromo} is false.
 */

import type { OptimizerPlan } from "@/lib/optimizer-plans"
import {
  canDisplayPromotionTerms,
  getPromotionForService,
  getPromotionStatus,
  type Promotion,
  type PromotionConfidence,
} from "@/lib/promotions"
import { demoMonthlyPriceUsd } from "@/lib/streaming-service-ids"

export type PromotionPricingResult = {
  baseMonthlyPriceUsd: number
  hasPromo: boolean
  effectiveIntroMonthlyPriceUsd?: number
  introPeriodMonths?: number
  savingsEstimateUsd?: number
  shouldDisplayPromo: boolean
  promoLabel?: string
  freshnessLabel?: string
  confidence: PromotionConfidence
}

/** Default horizon for “effective monthly” when splitting free months / credits (e.g. 3 free of 12). */
const DEFAULT_EFFECTIVE_HORIZON_MONTHS = 12

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100
}

function freshnessLabelFor(promotion: Promotion, now: Date): string | undefined {
  const status = getPromotionStatus(promotion, now)
  if (status === "expired") return "Expired"
  if (status === "stale") return "Stale"
  const d = new Date(promotion.lastUpdated)
  if (Number.isFinite(d.getTime())) {
    return `Fresh · ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  }
  return "Fresh"
}

/**
 * Horizons: use explicit `durationMonths` on the promo when it implies a commitment window;
 * otherwise default 12 for free-month / credit smoothing.
 */
function effectiveHorizonMonths(promotion: Promotion): number {
  const d = promotion.durationMonths
  if (d !== undefined && d > 0) return Math.max(d, DEFAULT_EFFECTIVE_HORIZON_MONTHS)
  return DEFAULT_EFFECTIVE_HORIZON_MONTHS
}

/**
 * Paid months at full base within [0, horizon] after `freeMonths` free.
 */
function effectiveMonthlyAfterFreeMonths(
  baseMonthlyPriceUsd: number,
  freeMonths: number,
  horizonMonths: number
): number {
  const h = Math.max(1, horizonMonths)
  const free = Math.max(0, Math.min(freeMonths, h))
  const paid = h - free
  return roundUsd((baseMonthlyPriceUsd * paid) / h)
}

/**
 * Intro price for `discMonths` months, then base for remainder of `horizonMonths`.
 */
function effectiveMonthlyIntroThenBase(
  baseMonthlyPriceUsd: number,
  introMonthlyPriceUsd: number,
  discMonths: number,
  horizonMonths: number
): number {
  const h = Math.max(1, horizonMonths)
  const introLen = Math.max(0, Math.min(discMonths, h))
  const tail = h - introLen
  const total = introMonthlyPriceUsd * introLen + baseMonthlyPriceUsd * tail
  return roundUsd(total / h)
}

/**
 * Percent off base for `discMonths`, then base for remainder of horizon.
 */
function effectiveMonthlyPercentOff(
  baseMonthlyPriceUsd: number,
  discountPercent: number,
  discMonths: number,
  horizonMonths: number
): number {
  const h = Math.max(1, horizonMonths)
  const introLen = Math.max(0, Math.min(discMonths, h))
  const tail = h - introLen
  const discounted = baseMonthlyPriceUsd * (1 - discountPercent / 100)
  const total = discounted * introLen + baseMonthlyPriceUsd * tail
  return roundUsd(total / h)
}

/**
 * One-time credit spread evenly over horizon (lowers average monthly).
 */
function effectiveMonthlyBundleCredit(
  baseMonthlyPriceUsd: number,
  creditUsd: number,
  horizonMonths: number
): number {
  const h = Math.max(1, horizonMonths)
  const total = baseMonthlyPriceUsd * h - Math.max(0, creditUsd)
  return roundUsd(total / h)
}

function buildPromoLabel(promotion: Promotion): string {
  if (promotion.description.length > 0 && promotion.description.length <= 120) return promotion.description
  switch (promotion.type) {
    case "free_trial":
      return promotion.freeMonths
        ? `${promotion.freeMonths} free month(s), then regular price`
        : "Free trial, then regular price"
    case "discount":
      if (promotion.introMonthlyPriceUsd !== undefined) return "Limited-time intro monthly rate"
      if (promotion.discountPercent !== undefined) return `${promotion.discountPercent}% off introductory period`
      return "Introductory discount"
    case "bundle_credit":
      return "Account credit or bundle savings (demo)"
    default:
      return "Promotion"
  }
}

/**
 * Computes display-safe intro effective monthly and savings vs base, or returns base-only when
 * {@link canDisplayPromotionTerms} is false.
 */
export function calculatePromotionPricing(
  baseMonthlyPriceUsd: number,
  promotion: Promotion,
  options?: { now?: Date; estimateHorizonMonths?: number }
): PromotionPricingResult {
  const now = options?.now ?? new Date()
  const horizon =
    options?.estimateHorizonMonths ??
    effectiveHorizonMonths(promotion)

  const base = roundUsd(baseMonthlyPriceUsd)
  const freshnessLabel = freshnessLabelFor(promotion, now)
  const shouldDisplay = canDisplayPromotionTerms(promotion, now)

  if (!shouldDisplay) {
    return {
      baseMonthlyPriceUsd: base,
      hasPromo: true,
      shouldDisplayPromo: false,
      confidence: promotion.confidence,
      promoLabel: buildPromoLabel(promotion),
      freshnessLabel,
    }
  }

  let effective: number | undefined
  let introPeriodMonths = Math.max(1, horizon)

  if (
    promotion.introMonthlyPriceUsd !== undefined &&
    promotion.introMonthlyPriceUsd >= 0 &&
    (promotion.durationMonths ?? 0) > 0
  ) {
    const introMonths = promotion.durationMonths ?? 12
    effective = effectiveMonthlyIntroThenBase(
      base,
      promotion.introMonthlyPriceUsd,
      introMonths,
      horizon
    )
    introPeriodMonths = horizon
  } else if (promotion.freeMonths !== undefined && promotion.freeMonths > 0) {
    effective = effectiveMonthlyAfterFreeMonths(base, promotion.freeMonths, horizon)
    introPeriodMonths = horizon
  } else if (
    promotion.discountPercent !== undefined &&
    promotion.discountPercent > 0 &&
    (promotion.durationMonths ?? 0) > 0
  ) {
    const discMonths = promotion.durationMonths ?? 1
    effective = effectiveMonthlyPercentOff(base, promotion.discountPercent, discMonths, horizon)
    introPeriodMonths = horizon
  } else if (
    promotion.type === "bundle_credit" &&
    promotion.discountAmountUsd !== undefined &&
    promotion.discountAmountUsd > 0
  ) {
    effective = effectiveMonthlyBundleCredit(base, promotion.discountAmountUsd, horizon)
    introPeriodMonths = horizon
  } else if (promotion.discountAmountUsd !== undefined && promotion.discountAmountUsd > 0) {
    effective = effectiveMonthlyBundleCredit(base, promotion.discountAmountUsd, horizon)
    introPeriodMonths = horizon
  }

  if (
    effective === undefined ||
    !Number.isFinite(effective) ||
    effective > base ||
    effective < 0
  ) {
    return {
      baseMonthlyPriceUsd: base,
      hasPromo: true,
      shouldDisplayPromo: false,
      confidence: promotion.confidence,
      promoLabel: buildPromoLabel(promotion),
      freshnessLabel,
    }
  }

  const savings = roundUsd(base - effective)
  if (savings < 0.01) {
    return {
      baseMonthlyPriceUsd: base,
      hasPromo: true,
      shouldDisplayPromo: false,
      confidence: promotion.confidence,
      promoLabel: buildPromoLabel(promotion),
      freshnessLabel,
    }
  }

  return {
    baseMonthlyPriceUsd: base,
    hasPromo: true,
    effectiveIntroMonthlyPriceUsd: effective,
    introPeriodMonths,
    savingsEstimateUsd: savings > 0 ? savings : undefined,
    shouldDisplayPromo: true,
    promoLabel: buildPromoLabel(promotion),
    freshnessLabel,
    confidence: promotion.confidence,
  }
}

/**
 * Resolve promotion for `serviceId` (with catalog aliases) and compute pricing.
 */
export function getServiceEffectivePrice(
  serviceId: string,
  baseMonthlyPriceUsd: number,
  now?: Date
): PromotionPricingResult {
  const base = roundUsd(baseMonthlyPriceUsd)
  const promotion = getPromotionForService(serviceId)
  if (!promotion) {
    return {
      baseMonthlyPriceUsd: base,
      hasPromo: false,
      shouldDisplayPromo: false,
      confidence: "high",
    }
  }
  return calculatePromotionPricing(base, promotion, { now })
}

/** Combined catalog plan row: allocate `plan.monthlyCost` across priced services, then sum intro-effective lines. */
export interface PlanBundlePromoSummary {
  baseMonthlyUsd: number
  showPromoLine: boolean
  introEffectiveMonthlyUsd?: number
  introPeriodMonths?: number
  savingsVsBaseMonthlyUsd?: number
  /** “With current offers: ~$X/mo for first Y months” */
  withOffersLine?: string
  /** “Estimated savings: ~$Z/mo” */
  savingsLine?: string
  /** Trial / intro narrative instead of savings-only (e.g. intro → then list). */
  promoReframeLine?: string
  attributionLine?: string
  freshnessLine?: string
}

/**
 * Pro-rates bundle list price across services with `demoMonthlyPriceUsd`, runs {@link getServiceEffectivePrice}
 * per slice, and sums intro averages only where `shouldDisplayPromo` is true.
 */
export function getPlanBundlePromoSummary(
  plan: OptimizerPlan,
  now: Date = new Date()
): PlanBundlePromoSummary {
  const baseMonthlyUsd = roundUsd(plan.monthlyCost)
  if (plan.tier === "radio" || baseMonthlyUsd <= 0) {
    return { baseMonthlyUsd, showPromoLine: false }
  }

  const priced = plan.servicesIncluded
    .map((id) => ({ id, demo: demoMonthlyPriceUsd(id) ?? 0 }))
    .filter((e) => e.demo > 0)

  if (priced.length === 0) {
    return { baseMonthlyUsd, showPromoLine: false }
  }

  const sumDemo = priced.reduce((s, e) => s + e.demo, 0)
  if (sumDemo <= 0) {
    return { baseMonthlyUsd, showPromoLine: false }
  }

  let combinedIntro = 0
  let anyDisplay = false
  let maxIntroMonths = 0
  const freshness: string[] = []

  for (const { id, demo } of priced) {
    const alloc = roundUsd((baseMonthlyUsd * demo) / sumDemo)
    const r = getServiceEffectivePrice(id, alloc, now)
    if (r.shouldDisplayPromo && r.effectiveIntroMonthlyPriceUsd !== undefined) {
      combinedIntro += r.effectiveIntroMonthlyPriceUsd
      anyDisplay = true
      maxIntroMonths = Math.max(maxIntroMonths, r.introPeriodMonths ?? 12)
      if (r.freshnessLabel) freshness.push(r.freshnessLabel)
    } else {
      combinedIntro += alloc
    }
  }

  combinedIntro = roundUsd(combinedIntro)
  const savings = roundUsd(baseMonthlyUsd - combinedIntro)

  if (!anyDisplay || savings < 0.01) {
    return { baseMonthlyUsd, showPromoLine: false }
  }

  const introPeriodMonths = Math.max(maxIntroMonths, 12)
  const uniqFresh = [...new Set(freshness)]
  const promoReframeLine = `Try intro bundle pricing ~$${combinedIntro.toFixed(
    2
  )}/mo avg for ${introPeriodMonths} months → then $${baseMonthlyUsd.toFixed(2)}/mo list`

  return {
    baseMonthlyUsd,
    showPromoLine: true,
    introEffectiveMonthlyUsd: combinedIntro,
    introPeriodMonths,
    savingsVsBaseMonthlyUsd: savings,
    withOffersLine: `With current offers: ~$${combinedIntro.toFixed(2)}/mo for first ${introPeriodMonths} months`,
    savingsLine: `Estimated savings: ~$${savings.toFixed(2)}/mo`,
    promoReframeLine,
    attributionLine: "Based on current offers",
    freshnessLine: uniqFresh[0],
  }
}
