/**
 * Promotion catalog: `fetchPromotions` (client: `@/lib/promotions-fetch.client`, server: `@/lib/promotions-fetch.server`)
 * hydrates the module store; `getPromotionForService` reads that store. Until the first successful fetch,
 * built-in defaults apply so SSR and offline dev stay consistent. Pricing still gates display via
 * `canDisplayPromotionTerms` / `isPromotionValid`.
 */

import type { PromotionConfidence } from "@/lib/promotion-db"
import type { Promotion } from "@/lib/promotion-model"
import { promotionRowToPromotion } from "@/lib/promotion-mapper"
import { DEFAULT_PROMOTION_ROWS } from "@/lib/promotions-default-rows"
import {
  getPromotionFromCatalog,
  getPromotionsCatalogList,
  isPromotionsCatalogHydrated,
} from "@/lib/promotions-catalog-store"
import { isPromotionValid } from "@/lib/promotions-validation"

export type { PromotionConfidence }
export type { Promotion }

const PROMOTION_SERVICE_ID_ALIASES: Record<string, string> = {
  directv: "directv-stream",
}

const FALLBACK_BY_SERVICE_ID: Record<string, Promotion> = {}
for (const row of DEFAULT_PROMOTION_ROWS) {
  const p = promotionRowToPromotion(row)
  FALLBACK_BY_SERVICE_ID[p.serviceId] = p
}

export function resolvePromotionCatalogId(serviceId: string): string {
  return PROMOTION_SERVICE_ID_ALIASES[serviceId] ?? serviceId
}

export function getPromotionForService(serviceId: string): Promotion | undefined {
  const key = resolvePromotionCatalogId(serviceId)
  const fromCatalog =
    getPromotionFromCatalog(key) ?? getPromotionFromCatalog(serviceId)
  if (fromCatalog) return fromCatalog
  if (!isPromotionsCatalogHydrated()) {
    const fallback = FALLBACK_BY_SERVICE_ID[key] ?? FALLBACK_BY_SERVICE_ID[serviceId]
    return fallback ? { ...fallback } : undefined
  }
  return undefined
}

export function listMockPromotions(): Promotion[] {
  if (isPromotionsCatalogHydrated()) {
    return getPromotionsCatalogList()
  }
  return DEFAULT_PROMOTION_ROWS.map(promotionRowToPromotion)
}

export function canDisplayPromotionTerms(promotion: Promotion, now: Date = new Date()): boolean {
  return isPromotionValid(promotion, now)
}

export {
  getPromotionStatus,
  isPromotionExpired,
  isPromotionFresh,
  isPromotionStale,
  isPromotionValid,
  isConfidenceDisplayable,
  type PromotionDisplayStatus,
  type PromotionLike,
} from "@/lib/promotions-validation"
