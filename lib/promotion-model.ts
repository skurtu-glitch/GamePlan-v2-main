import type { PromotionConfidence } from "@/lib/promotion-db"

/** Canonical promotion shape for catalog + pricing (shared by mapper, store, and API). */
export type Promotion = {
  serviceId: string
  description: string
  type: "free_trial" | "discount" | "bundle_credit"
  durationMonths?: number
  freeMonths?: number
  discountPercent?: number
  discountAmountUsd?: number
  introMonthlyPriceUsd?: number
  expiresAt?: string
  lastUpdated: string
  sourceLabel: string
  sourceUrl?: string
  confidence: PromotionConfidence
}
