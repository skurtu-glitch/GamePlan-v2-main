import type { PromotionRow } from "@/lib/promotion-db"
import {
  readPromotionRowsFromDisk,
  writePromotionRowsToDisk,
} from "@/lib/promotions-storage.server"
import { NextResponse } from "next/server"

function parseRowBody(raw: unknown): Omit<PromotionRow, "id" | "last_updated"> | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const service_id = typeof o.service_id === "string" ? o.service_id.trim() : ""
  const description = typeof o.description === "string" ? o.description : ""
  const type = o.type as PromotionRow["type"]
  if (!service_id || !description) return null
  if (type !== "free_trial" && type !== "discount" && type !== "bundle_credit") return null
  const confidence = o.confidence as PromotionRow["confidence"]
  if (confidence !== "high" && confidence !== "medium" && confidence !== "low") return null

  return {
    service_id,
    description,
    type,
    free_months: typeof o.free_months === "number" ? o.free_months : null,
    discount_percent: typeof o.discount_percent === "number" ? o.discount_percent : null,
    intro_price_usd: typeof o.intro_price_usd === "number" ? o.intro_price_usd : null,
    discount_amount_usd: typeof o.discount_amount_usd === "number" ? o.discount_amount_usd : null,
    duration_months: typeof o.duration_months === "number" ? o.duration_months : null,
    expires_at: typeof o.expires_at === "string" && o.expires_at ? o.expires_at : null,
    confidence,
    source_label: typeof o.source_label === "string" ? o.source_label : "",
    source_url: typeof o.source_url === "string" && o.source_url ? o.source_url : null,
  }
}

export async function GET() {
  const promotions = await readPromotionRowsFromDisk()
  return NextResponse.json({ promotions })
}

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const base = parseRowBody(json)
  if (!base) {
    return NextResponse.json({ error: "Invalid promotion payload" }, { status: 400 })
  }

  const rows = await readPromotionRowsFromDisk()
  if (rows.some((r) => r.service_id === base.service_id)) {
    return NextResponse.json({ error: "service_id already exists" }, { status: 409 })
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row: PromotionRow = {
    id,
    ...base,
    last_updated: now,
  }
  const next = [...rows, row]
  await writePromotionRowsToDisk(next)
  return NextResponse.json({ promotion: row })
}
