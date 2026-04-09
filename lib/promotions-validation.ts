/**
 * Promotion validity for product display and admin status chips.
 * Rules: stale if last_updated older than 7 days; expired if expires_at < now; invalid if confidence is low.
 */

import type { PromotionConfidence } from "@/lib/promotion-db"

/** Shape needed for freshness / validity checks (avoids circular import with `lib/promotions.ts`). */
export type PromotionLike = {
  expiresAt?: string
  lastUpdated: string
  confidence: PromotionConfidence
}

export type PromotionDisplayStatus = "fresh" | "stale" | "expired"

/** Age after which last_updated is considered stale (exclusive of exactly 7d boundary: older than 7d). */
export const PROMOTION_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export function isPromotionExpired(promotion: Pick<PromotionLike, "expiresAt">, now: Date = new Date()): boolean {
  if (!promotion.expiresAt) return false
  const exp = new Date(promotion.expiresAt).getTime()
  return Number.isFinite(exp) && exp <= now.getTime()
}

export function isPromotionStale(promotion: Pick<PromotionLike, "lastUpdated">, now: Date = new Date()): boolean {
  const updated = new Date(promotion.lastUpdated).getTime()
  if (!Number.isFinite(updated)) return true
  return now.getTime() - updated > PROMOTION_STALE_AFTER_MS
}

/**
 * “Fresh” for product logic: not expired and not stale by last_updated.
 */
export function isPromotionFresh(promotion: PromotionLike, now: Date = new Date()): boolean {
  if (isPromotionExpired(promotion, now)) return false
  if (isPromotionStale(promotion, now)) return false
  return true
}

export function getPromotionStatus(
  promotion: PromotionLike,
  now: Date = new Date()
): PromotionDisplayStatus {
  if (isPromotionExpired(promotion, now)) return "expired"
  if (isPromotionStale(promotion, now)) return "stale"
  return "fresh"
}

export function isPromotionValid(promotion: PromotionLike, now: Date = new Date()): boolean {
  if (promotion.confidence === "low") return false
  return isPromotionFresh(promotion, now)
}

export function isConfidenceDisplayable(c: PromotionConfidence): boolean {
  return c === "high" || c === "medium"
}
