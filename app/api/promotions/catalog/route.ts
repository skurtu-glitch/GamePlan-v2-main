import { loadPromotionsFromSource } from "@/lib/promotions-fetch.server"
import { NextResponse } from "next/server"

export async function GET() {
  const promotions = await loadPromotionsFromSource()
  return NextResponse.json({ promotions })
}
