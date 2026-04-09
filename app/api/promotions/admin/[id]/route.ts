import type { PromotionRow } from "@/lib/promotion-db"
import {
  readPromotionRowsFromDisk,
  writePromotionRowsToDisk,
} from "@/lib/promotions-storage.server"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }
  const patch = json as Record<string, unknown>

  const rows = await readPromotionRowsFromDisk()
  const idx = rows.findIndex((r) => r.id === id)
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const cur = rows[idx]
  const next: PromotionRow = { ...cur }

  if (typeof patch.service_id === "string" && patch.service_id.trim()) {
    const sid = patch.service_id.trim()
    if (rows.some((r, i) => r.service_id === sid && i !== idx)) {
      return NextResponse.json({ error: "service_id already exists" }, { status: 409 })
    }
    next.service_id = sid
  }
  if (typeof patch.description === "string") next.description = patch.description
  if (
    patch.type === "free_trial" ||
    patch.type === "discount" ||
    patch.type === "bundle_credit"
  ) {
    next.type = patch.type
  }
  if (patch.free_months === null || typeof patch.free_months === "number") {
    next.free_months = patch.free_months as number | null
  }
  if (patch.discount_percent === null || typeof patch.discount_percent === "number") {
    next.discount_percent = patch.discount_percent as number | null
  }
  if (patch.intro_price_usd === null || typeof patch.intro_price_usd === "number") {
    next.intro_price_usd = patch.intro_price_usd as number | null
  }
  if (patch.discount_amount_usd === null || typeof patch.discount_amount_usd === "number") {
    next.discount_amount_usd = patch.discount_amount_usd as number | null
  }
  if (patch.duration_months === null || typeof patch.duration_months === "number") {
    next.duration_months = patch.duration_months as number | null
  }
  if (patch.expires_at === null || typeof patch.expires_at === "string") {
    next.expires_at = patch.expires_at as string | null
  }
  if (patch.confidence === "high" || patch.confidence === "medium" || patch.confidence === "low") {
    next.confidence = patch.confidence
  }
  if (typeof patch.source_label === "string") next.source_label = patch.source_label
  if (patch.source_url === null || typeof patch.source_url === "string") {
    next.source_url = patch.source_url as string | null
  }

  next.last_updated = new Date().toISOString()

  const out = [...rows]
  out[idx] = next
  await writePromotionRowsToDisk(out)
  return NextResponse.json({ promotion: next })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const rows = await readPromotionRowsFromDisk()
  const next = rows.filter((r) => r.id !== id)
  if (next.length === rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await writePromotionRowsToDisk(next)
  return NextResponse.json({ ok: true })
}
