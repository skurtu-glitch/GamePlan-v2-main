/**
 * Central affiliate + monetization helpers (UTM-tagged outbound URLs, offers, effective pricing).
 * Internal navigation (/plans, /settings, /game/…) stays outside this module.
 */

import { getEngineGames } from "@/lib/data"
import type { OptimizerPlan } from "@/lib/optimizer-plans"
import { getPromotionForService } from "@/lib/promotions"
import {
  isConfidenceDisplayable,
  isPromotionValid,
} from "@/lib/promotions-validation"
import type { Promotion } from "@/lib/promotion-model"
import {
  demoMonthlyPriceUsd,
  serviceDisplayName,
} from "@/lib/streaming-service-ids"
import { getServiceEffectivePrice } from "@/lib/promotion-pricing"

/** Context appended as UTM + custom params on outbound partner URLs. */
export type AffiliateLinkContext = {
  /** e.g. assistant, plans, game_detail */
  sourceScreen: string
  /** e.g. assistant_plan, assistant_watch, plans_card */
  intent: string
  planId?: string
}

export type AffiliateBestOfferType = "discount" | "free_months" | "none"

export interface AffiliateBestOffer {
  type: AffiliateBestOfferType
  /** Percent off, dollars off, or number of free months — depends on `type`. */
  value: number | null
  /** Months the offer runs when applicable. */
  duration: number | null
  confidence: Promotion["confidence"]
}

export interface AffiliateEffectivePrice {
  listPrice: number
  effectiveMonthlyPrice: number
  estimatedSavings: number
  /** When false, callers should show list only (low confidence or no promo). */
  showPromoAdjusted: boolean
  promoLabel?: string
}

/** Official subscribe / signup entry points (add real partner program URLs as needed). */
const SERVICE_SUBSCRIBE_BASE: Partial<Record<string, string>> = {
  "espn-plus": "https://www.espn.com/espnplus/",
  max: "https://www.max.com/",
  "fanduel-sports": "https://www.fanduelsportsnetwork.com/",
  "mlb-tv": "https://www.mlb.com/live-stream-games/",
  "nhl-tv": "https://www.nhl.com/tv",
  directv: "https://www.directv.com/stream/",
  "youtube-tv": "https://tv.youtube.com/welcome/",
}

export function hasAffiliateLanding(serviceId: string): boolean {
  return SERVICE_SUBSCRIBE_BASE[serviceId] !== undefined
}

export function resolvePrimaryVideoServiceIdForGame(
  gameId: string
): string | undefined {
  const game = getEngineGames().find((g) => g.id === gameId)
  const ids = game?.watch?.providers
  if (ids && ids.length > 0) return ids[0]
  return undefined
}

/**
 * Outbound URL with tracking params. Falls back to `/settings/services` when no
 * partner landing is configured (still high-intent; not counted as affiliate outbound).
 */
export function getAffiliateLink(
  serviceId: string,
  context: AffiliateLinkContext
): string {
  const base = SERVICE_SUBSCRIBE_BASE[serviceId]
  if (!base) {
    const q = new URLSearchParams({
      highlight: serviceId,
      utm_source: "gameplan",
      utm_medium: "internal",
      utm_campaign: context.intent,
    })
    return `/settings/services?${q.toString()}`
  }
  const u = new URL(base)
  u.searchParams.set("utm_source", "gameplan")
  u.searchParams.set("utm_medium", "affiliate")
  u.searchParams.set("utm_campaign", context.intent.slice(0, 120))
  u.searchParams.set("utm_content", serviceId)
  u.searchParams.set("utm_term", context.sourceScreen.slice(0, 60))
  if (context.planId) u.searchParams.set("gp_plan", context.planId)
  return u.toString()
}

export function getBestOffer(serviceId: string, now = new Date()): AffiliateBestOffer {
  const promotion = getPromotionForService(serviceId)
  if (!promotion) {
    return { type: "none", value: null, duration: null, confidence: "high" }
  }
  const confidence = promotion.confidence
  if (!isPromotionValid(promotion, now) || !isConfidenceDisplayable(confidence)) {
    return { type: "none", value: null, duration: null, confidence }
  }
  if (promotion.freeMonths && promotion.freeMonths > 0) {
    return {
      type: "free_months",
      value: promotion.freeMonths,
      duration: promotion.durationMonths ?? promotion.freeMonths,
      confidence,
    }
  }
  if (
    promotion.type === "discount" &&
    promotion.discountPercent !== undefined &&
    promotion.discountPercent > 0
  ) {
    return {
      type: "discount",
      value: promotion.discountPercent,
      duration: promotion.durationMonths ?? null,
      confidence,
    }
  }
  if (
    promotion.introMonthlyPriceUsd !== undefined &&
    promotion.introMonthlyPriceUsd >= 0
  ) {
    return {
      type: "discount",
      value: promotion.introMonthlyPriceUsd,
      duration: promotion.durationMonths ?? null,
      confidence,
    }
  }
  if (
    promotion.discountAmountUsd !== undefined &&
    promotion.discountAmountUsd > 0
  ) {
    return {
      type: "discount",
      value: promotion.discountAmountUsd,
      duration: promotion.durationMonths ?? null,
      confidence,
    }
  }
  return { type: "none", value: null, duration: null, confidence }
}

export function getEffectivePrice(
  serviceId: string,
  now = new Date()
): AffiliateEffectivePrice {
  const list = demoMonthlyPriceUsd(serviceId) ?? 0
  if (list <= 0) {
    return {
      listPrice: 0,
      effectiveMonthlyPrice: 0,
      estimatedSavings: 0,
      showPromoAdjusted: false,
    }
  }
  const r = getServiceEffectivePrice(serviceId, list, now)
  const showPromoAdjusted =
    r.shouldDisplayPromo &&
    r.effectiveIntroMonthlyPriceUsd !== undefined &&
    isConfidenceDisplayable(r.confidence)
  const effective = showPromoAdjusted
    ? (r.effectiveIntroMonthlyPriceUsd as number)
    : list
  const estimatedSavings = Math.max(0, round2(list - effective))
  return {
    listPrice: round2(list),
    effectiveMonthlyPrice: round2(effective),
    estimatedSavings,
    showPromoAdjusted,
    ...(showPromoAdjusted && r.promoLabel ? { promoLabel: r.promoLabel } : {}),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** First streaming service on a plan that has an outbound affiliate landing (else first priced id). */
export function primaryAffiliateServiceIdForPlan(plan: OptimizerPlan): string | undefined {
  for (const id of plan.servicesIncluded) {
    if (id === "team-radio" || id === "siriusxm") continue
    if (hasAffiliateLanding(id)) return id
  }
  for (const id of plan.servicesIncluded) {
    if (id === "team-radio" || id === "siriusxm") continue
    if (demoMonthlyPriceUsd(id) !== undefined) return id
  }
  return undefined
}

export function startSubscriptionLabel(serviceId: string): string {
  return `Start ${serviceDisplayName(serviceId)}`
}

export function startSubscriptionLabelWithSavings(
  serviceId: string,
  now = new Date()
): string {
  const base = startSubscriptionLabel(serviceId)
  const p = getEffectivePrice(serviceId, now)
  if (p.showPromoAdjusted && p.estimatedSavings >= 0.5) {
    return `${base} · ~$${p.estimatedSavings.toFixed(2)}/mo off list`
  }
  return base
}
