import {
  mergeDemoUserState,
  withSyncedSubscriptionFields,
  type DemoUserState,
} from "@/lib/demo-user"

/** Written on every successful profile upsert so we can tell `{}` from a real save. */
export const GP_PROFILE_SAVED_KEY = "__gp_saved" as const

/**
 * JSON we store in `profiles.payload` (subscriptions drive `connectedServiceIds` on load).
 */
export type GamePlanProfilePayload = Pick<
  DemoUserState,
  "subscriptions" | "location" | "preferences" | "followedTeamIds"
> & {
  [GP_PROFILE_SAVED_KEY]?: true
}

/** True when this row was written by GamePlan (not an empty default row). */
export function rawPayloadHasAccountSnapshot(payload: unknown): boolean {
  if (payload === null || typeof payload !== "object") return false
  return (payload as Record<string, unknown>)[GP_PROFILE_SAVED_KEY] === true
}

export function stateToProfilePayload(state: DemoUserState): GamePlanProfilePayload {
  return {
    subscriptions: state.subscriptions,
    location: state.location,
    preferences: state.preferences,
    followedTeamIds: state.followedTeamIds,
    [GP_PROFILE_SAVED_KEY]: true,
  }
}

/** Apply a DB payload on top of `fallback` (e.g. local snapshot before first remote load). */
export function stateFromProfilePayload(
  payload: unknown,
  fallback: DemoUserState
): DemoUserState {
  if (!payload || typeof payload !== "object") {
    return withSyncedSubscriptionFields(fallback)
  }
  return withSyncedSubscriptionFields(
    mergeDemoUserState(payload, fallback)
  )
}
