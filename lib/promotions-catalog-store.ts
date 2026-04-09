import type { Promotion } from "@/lib/promotion-model"

let catalogByServiceId: Record<string, Promotion> = {}
let hydrated = false

export function setPromotionsCatalog(
  promotions: Promotion[],
  options?: { hydrated?: boolean }
): void {
  const byId: Record<string, Promotion> = {}
  for (const p of promotions) {
    byId[p.serviceId] = p
  }
  catalogByServiceId = byId
  hydrated = options?.hydrated !== false
}

export function isPromotionsCatalogHydrated(): boolean {
  return hydrated
}

export function getPromotionFromCatalog(serviceId: string): Promotion | undefined {
  const p = catalogByServiceId[serviceId]
  return p ? { ...p } : undefined
}

export function getPromotionsCatalogList(): Promotion[] {
  return Object.values(catalogByServiceId).map((p) => ({ ...p }))
}

export function clearPromotionsCatalog(): void {
  catalogByServiceId = {}
  hydrated = false
}
