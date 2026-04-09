import "server-only"

import fs from "fs/promises"
import path from "path"
import type { PromotionRow, PromotionsFileShape } from "@/lib/promotion-db"
import { DEFAULT_PROMOTION_ROWS } from "@/lib/promotions-default-rows"

const DATA_PATH = path.join(process.cwd(), "data", "promotions.json")

export async function readPromotionRowsFromDisk(): Promise<PromotionRow[]> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8")
    const parsed = JSON.parse(raw) as PromotionsFileShape
    if (Array.isArray(parsed.promotions)) return parsed.promotions
  } catch {
    /* missing or invalid */
  }
  return [...DEFAULT_PROMOTION_ROWS]
}

export async function writePromotionRowsToDisk(rows: PromotionRow[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true })
  const body: PromotionsFileShape = { promotions: rows }
  await fs.writeFile(DATA_PATH, JSON.stringify(body, null, 2), "utf8")
}
