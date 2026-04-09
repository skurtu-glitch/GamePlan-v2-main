import type { Promotion } from "@/lib/promotion-model"
import type { PromotionRow } from "@/lib/promotion-db"

export function promotionRowToPromotion(row: PromotionRow): Promotion {
  return {
    serviceId: row.service_id,
    description: row.description,
    type: row.type,
    durationMonths: row.duration_months ?? undefined,
    freeMonths: row.free_months ?? undefined,
    discountPercent: row.discount_percent ?? undefined,
    discountAmountUsd: row.discount_amount_usd ?? undefined,
    introMonthlyPriceUsd: row.intro_price_usd ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    lastUpdated: row.last_updated,
    sourceLabel: row.source_label,
    confidence: row.confidence,
    sourceUrl: row.source_url ?? undefined,
  }
}

export function promotionToRow(p: Promotion, id: string): PromotionRow {
  return {
    id,
    service_id: p.serviceId,
    description: p.description,
    type: p.type,
    free_months: p.freeMonths ?? null,
    discount_percent: p.discountPercent ?? null,
    intro_price_usd: p.introMonthlyPriceUsd ?? null,
    discount_amount_usd: p.discountAmountUsd ?? null,
    duration_months: p.durationMonths ?? null,
    expires_at: p.expiresAt ?? null,
    last_updated: p.lastUpdated,
    confidence: p.confidence,
    source_label: p.sourceLabel,
    source_url: p.sourceUrl ?? null,
  }
}
