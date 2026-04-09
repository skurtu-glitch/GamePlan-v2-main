import type { Promotion } from "@/lib/promotion-model"
import {
  clearPromotionsCatalog,
  getPromotionFromCatalog,
  getPromotionsCatalogList,
  isPromotionsCatalogHydrated,
  setPromotionsCatalog,
} from "@/lib/promotions-catalog-store"

/** @deprecated Prefer {@link setPromotionsCatalog} — alias for backward compatibility. */
export function setClientPromotionsCatalog(promotions: Promotion[]): void {
  setPromotionsCatalog(promotions, { hydrated: true })
}

export function clearClientPromotionsCatalog(): void {
  clearPromotionsCatalog()
}

export function getClientPromotionsList(): Promotion[] | null {
  if (!isPromotionsCatalogHydrated()) return null
  return getPromotionsCatalogList()
}

export function getPromotionFromClientCatalog(serviceId: string): Promotion | undefined {
  return getPromotionFromCatalog(serviceId)
}
