import type { Promotion } from "@/lib/promotion-model"
import { promotionRowToPromotion } from "@/lib/promotion-mapper"
import { DEFAULT_PROMOTION_ROWS } from "@/lib/promotions-default-rows"
import { setPromotionsCatalog } from "@/lib/promotions-catalog-store"

function fallbackPromotions(): Promotion[] {
  return DEFAULT_PROMOTION_ROWS.map(promotionRowToPromotion)
}

/**
 * Browser entry: loads the live catalog from `/api/promotions/catalog`, hydrates the shared store,
 * and falls back to seeded rows if the network or payload is unavailable (local dev / DB not ready).
 */
export async function fetchPromotions(): Promise<Promotion[]> {
  try {
    const res = await fetch("/api/promotions/catalog", { cache: "no-store" })
    if (!res.ok) throw new Error(`Promotions catalog HTTP ${res.status}`)
    const data = (await res.json()) as { promotions?: unknown }
    const raw = data.promotions
    if (!Array.isArray(raw)) throw new Error("Invalid promotions payload")
    const promotions = raw as Promotion[]
    setPromotionsCatalog(promotions, { hydrated: true })
    return promotions
  } catch {
    const promotions = fallbackPromotions()
    setPromotionsCatalog(promotions, { hydrated: true })
    return promotions
  }
}
