import "server-only"

import type { Promotion } from "@/lib/promotion-model"
import { promotionRowToPromotion } from "@/lib/promotion-mapper"
import { readPromotionRowsFromDisk } from "@/lib/promotions-storage.server"
import { setPromotionsCatalog } from "@/lib/promotions-catalog-store"

/**
 * Load promotions from the configured source (local JSON today; swap for Supabase in production).
 * Does not touch the in-memory catalog — safe for API routes and parallel requests.
 */
export async function loadPromotionsFromSource(): Promise<Promotion[]> {
  const rows = await readPromotionRowsFromDisk()
  return rows.map(promotionRowToPromotion)
}

/**
 * Async load for server runtimes. Optionally hydrates the module catalog.
 * Pass `hydrate: true` only when explicitly wiring server-side consumers; API routes should omit it.
 */
export async function fetchPromotions(options?: {
  hydrate?: boolean
}): Promise<Promotion[]> {
  const promotions = await loadPromotionsFromSource()
  if (options?.hydrate === true) {
    setPromotionsCatalog(promotions, { hydrated: true })
  }
  return promotions
}
