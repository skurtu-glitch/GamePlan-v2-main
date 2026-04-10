import type { SupabaseClient } from "@supabase/supabase-js"
import {
  defaultDemoUserState,
  withSyncedSubscriptionFields,
  type DemoUserState,
} from "@/lib/demo-user"
import {
  rawPayloadHasAccountSnapshot,
  stateFromProfilePayload,
  stateToProfilePayload,
} from "./profile-payload"

export async function fetchProfileForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<DemoUserState | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("payload")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.warn("[GamePlan] profile fetch failed:", error.message)
    return null
  }
  if (!data?.payload) return null
  // Empty `{}` or legacy rows without our marker → treat as “no cloud profile yet” and seed from device state.
  if (!rawPayloadHasAccountSnapshot(data.payload)) return null
  return stateFromProfilePayload(data.payload, defaultDemoUserState)
}

export type ProfileUpsertResult = { ok: true } | { ok: false; message: string }

export async function upsertProfileForUserWithResult(
  supabase: SupabaseClient,
  userId: string,
  state: DemoUserState
): Promise<ProfileUpsertResult> {
  const payload = stateToProfilePayload(withSyncedSubscriptionFields(state))
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  )
  if (error) {
    console.warn("[GamePlan] profile save failed:", error.message)
    return { ok: false, message: error.message }
  }
  return { ok: true }
}

export async function upsertProfileForUser(
  supabase: SupabaseClient,
  userId: string,
  state: DemoUserState
): Promise<void> {
  await upsertProfileForUserWithResult(supabase, userId, state)
}
