/** Database / JSON row shape for promotions admin + storage. */

export type PromotionConfidence = "high" | "medium" | "low"

export type PromotionRow = {
  id: string
  service_id: string
  description: string
  type: "free_trial" | "discount" | "bundle_credit"
  free_months: number | null
  discount_percent: number | null
  intro_price_usd: number | null
  discount_amount_usd: number | null
  duration_months: number | null
  expires_at: string | null
  last_updated: string
  confidence: PromotionConfidence
  source_label: string
  source_url: string | null
}

export type PromotionsFileShape = {
  promotions: PromotionRow[]
}
