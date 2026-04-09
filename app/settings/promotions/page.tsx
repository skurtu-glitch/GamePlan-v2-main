"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useReloadPromotionsCatalog } from "@/components/providers/promotions-provider"
import type { PromotionRow } from "@/lib/promotion-db"
import { promotionRowToPromotion } from "@/lib/promotion-mapper"
import { getPromotionStatus } from "@/lib/promotions"
import { ArrowLeft, Loader2, Plus, Tag, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

function statusClass(status: ReturnType<typeof getPromotionStatus>) {
  switch (status) {
    case "fresh":
      return "bg-emerald-500/15 text-emerald-400"
    case "stale":
      return "bg-amber-500/15 text-amber-400"
    case "expired":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-secondary text-muted-foreground"
  }
}

const emptyForm: Omit<PromotionRow, "id" | "last_updated"> = {
  service_id: "",
  description: "",
  type: "discount",
  free_months: null,
  discount_percent: null,
  intro_price_usd: null,
  discount_amount_usd: null,
  duration_months: null,
  expires_at: null,
  confidence: "high",
  source_label: "",
  source_url: null,
}

export default function PromotionsAdminPage() {
  const reloadCatalog = useReloadPromotionsCatalog()
  const [rows, setRows] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/promotions/admin", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load")
      const data = (await res.json()) as { promotions: PromotionRow[] }
      setRows(Array.isArray(data.promotions) ? data.promotions : [])
    } catch {
      setError("Could not load promotions.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/promotions/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const e = (await res.json()) as { error?: string }
        throw new Error(e.error ?? "Create failed")
      }
      setForm(emptyForm)
      setCreating(false)
      await load()
      await reloadCatalog()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(id: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/promotions/admin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const e = (await res.json()) as { error?: string }
        throw new Error(e.error ?? "Save failed")
      }
      setEditingId(null)
      setForm(emptyForm)
      await load()
      await reloadCatalog()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this promotion?")) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/promotions/admin/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setEditingId(null)
      await load()
      await reloadCatalog()
    } catch {
      setError("Delete failed")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row: PromotionRow) {
    setCreating(false)
    setEditingId(row.id)
    setForm({
      service_id: row.service_id,
      description: row.description,
      type: row.type,
      free_months: row.free_months,
      discount_percent: row.discount_percent,
      intro_price_usd: row.intro_price_usd,
      discount_amount_usd: row.discount_amount_usd,
      duration_months: row.duration_months,
      expires_at: row.expires_at,
      confidence: row.confidence,
      source_label: row.source_label,
      source_url: row.source_url,
    })
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link
            href="/settings"
            className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex size-10 items-center justify-center rounded-full bg-accent/15">
            <Tag className="size-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Promotions</h1>
            <p className="text-xs text-muted-foreground">Edit offer copy and eligibility (local JSON)</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={creating ? "secondary" : "default"}
            size="sm"
            className="gap-1"
            onClick={() => {
              setCreating((c) => !c)
              setEditingId(null)
              setForm(emptyForm)
            }}
          >
            <Plus className="size-4" />
            {creating ? "Cancel new" : "New promotion"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>

        {creating && (
          <Card className="border-border p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Create promotion</h2>
            <PromotionFormFields form={form} setForm={setForm} />
            <Button className="mt-4" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Create"}
            </Button>
          </Card>
        )}

        {editingId && (
          <Card className="border-accent/30 p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Edit promotion</h2>
            <PromotionFormFields form={form} setForm={setForm} />
            <div className="mt-4 flex gap-2">
              <Button onClick={() => void handleSave(editingId)} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        <Card className="overflow-x-auto border-border p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No rows. Add JSON under data/promotions.json or create one.</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/40 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const p = promotionRowToPromotion(row)
                  const status = getPromotionStatus(p)
                  return (
                    <tr key={row.id} className="hover:bg-secondary/20">
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            statusClass(status)
                          )}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">{row.service_id}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.type}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.confidence}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(row.last_updated).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-accent"
                          onClick={() => startEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-red-400"
                          onClick={() => void handleDelete(row.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Product UI only shows promos that are <strong className="font-medium text-foreground">fresh</strong>{" "}
          (updated within 7 days), not <strong className="font-medium text-foreground">expired</strong>, and with{" "}
          <strong className="font-medium text-foreground">medium or high</strong> confidence. On Vercel, use
          Supabase + the included migration, or a writable store—local <code className="rounded bg-secondary px-1">data/promotions.json</code> works in dev.
        </p>
      </main>

      <BottomNav />
    </div>
  )
}

function PromotionFormFields({
  form,
  setForm,
}: {
  form: Omit<PromotionRow, "id" | "last_updated">
  setForm: (f: Omit<PromotionRow, "id" | "last_updated">) => void
}) {
  const numOrNull = (v: string): number | null => {
    if (v === "" || v === null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-muted-foreground">
        service_id
        <Input
          className="mt-1 font-mono text-sm"
          value={form.service_id}
          onChange={(e) => setForm({ ...form, service_id: e.target.value })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        type
        <select
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.type}
          onChange={(e) =>
            setForm({
              ...form,
              type: e.target.value as PromotionRow["type"],
            })
          }
        >
          <option value="free_trial">free_trial</option>
          <option value="discount">discount</option>
          <option value="bundle_credit">bundle_credit</option>
        </select>
      </label>
      <label className="sm:col-span-2 text-xs text-muted-foreground">
        description
        <Input
          className="mt-1 text-sm"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        confidence
        <select
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.confidence}
          onChange={(e) =>
            setForm({
              ...form,
              confidence: e.target.value as PromotionRow["confidence"],
            })
          }
        >
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        source_label
        <Input
          className="mt-1 text-sm"
          value={form.source_label}
          onChange={(e) => setForm({ ...form, source_label: e.target.value })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        source_url
        <Input
          className="mt-1 text-sm"
          value={form.source_url ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              source_url: e.target.value.trim() ? e.target.value.trim() : null,
            })
          }
        />
      </label>
      <label className="text-xs text-muted-foreground">
        free_months
        <Input
          className="mt-1 text-sm"
          type="number"
          value={form.free_months ?? ""}
          onChange={(e) => setForm({ ...form, free_months: numOrNull(e.target.value) })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        discount_percent
        <Input
          className="mt-1 text-sm"
          type="number"
          value={form.discount_percent ?? ""}
          onChange={(e) => setForm({ ...form, discount_percent: numOrNull(e.target.value) })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        intro_price_usd
        <Input
          className="mt-1 text-sm"
          type="number"
          step="0.01"
          value={form.intro_price_usd ?? ""}
          onChange={(e) => setForm({ ...form, intro_price_usd: numOrNull(e.target.value) })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        discount_amount_usd (bundle)
        <Input
          className="mt-1 text-sm"
          type="number"
          step="0.01"
          value={form.discount_amount_usd ?? ""}
          onChange={(e) => setForm({ ...form, discount_amount_usd: numOrNull(e.target.value) })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        duration_months
        <Input
          className="mt-1 text-sm"
          type="number"
          value={form.duration_months ?? ""}
          onChange={(e) => setForm({ ...form, duration_months: numOrNull(e.target.value) })}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        expires_at (ISO)
        <Input
          className="mt-1 font-mono text-sm"
          placeholder="2026-12-31T23:59:59.000Z"
          value={form.expires_at ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              expires_at: e.target.value.trim() ? e.target.value.trim() : null,
            })
          }
        />
      </label>
    </div>
  )
}
