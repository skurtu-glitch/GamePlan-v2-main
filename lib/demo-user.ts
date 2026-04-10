import type { Team } from "@/lib/types"

export type UserSubscription = {
  serviceId: string
  /** Catalog or provider tier label when known (e.g. “premium”, “with-ads”). */
  planTier?: string
}

export interface DemoLocation {
  city: string
  state: string
  /** Broadcast / market label for demo scenarios */
  marketLabel?: string
  /** Optional ZIP (used for coarse home-market inference when `regionCode` is unset). */
  zipCode?: string
  /**
   * Explicit home market for blackout rules: `stl` | `den` | `chi` (see `lib/market-regions.ts`).
   * When set, overrides ZIP/city inference.
   */
  regionCode?: string
}

export interface DemoUserPreferences {
  displayName: string
  notificationsEnabled: boolean
  darkMode: boolean
  /**
   * Persisted for Settings; reserved for future regional / market behavior.
   * Does not change resolver output in this MVP.
   */
  regionalLocationEnabled: boolean
}

/** Default followed teams when none are stored (demo + new accounts). */
export const DEFAULT_FOLLOWED_TEAM_IDS: readonly string[] = [
  "stl-blues",
  "stl-cardinals",
]

export interface DemoUserState {
  /**
   * Canonical entitlements for MVP+. Prefer updating subscriptions; `connectedServiceIds` is kept in
   * lockstep for existing resolver/optimizer code paths.
   */
  subscriptions: UserSubscription[]
  /**
   * Derived from {@link DemoUserState.subscriptions} (unique `serviceId` list, stable order).
   * Retained for backward compatibility with `resolveGameAccess`, optimizers, and pricing helpers.
   */
  connectedServiceIds: string[]
  /** Team ids from `lib/data` catalog the user follows (drives Home / Assistant / My Teams). */
  followedTeamIds: string[]
  location: DemoLocation
  preferences: DemoUserPreferences
}

/** Current persisted shape (v2). Legacy v1 JSON is still read by the provider. */
export const DEMO_USER_STORAGE_KEY = "gameplan-demo-user-v2"

/** @deprecated Read for one-time migration only. */
export const DEMO_USER_STORAGE_KEY_LEGACY = "gameplan-demo-user-v1"

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

function parseSubscriptionsArray(raw: unknown): UserSubscription[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: UserSubscription[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const serviceId = typeof item.serviceId === "string" ? item.serviceId.trim() : ""
    if (!serviceId) continue
    const planTier =
      typeof item.planTier === "string" && item.planTier.trim()
        ? item.planTier.trim()
        : undefined
    out.push(planTier ? { serviceId, planTier } : { serviceId })
  }
  return out
}

function dedupeSubscriptions(subs: UserSubscription[]): UserSubscription[] {
  const byId = new Map<string, UserSubscription>()
  for (const s of subs) {
    const id = s.serviceId
    const prev = byId.get(id)
    if (!prev) {
      byId.set(id, { ...s })
      continue
    }
    const tier = s.planTier ?? prev.planTier
    byId.set(id, tier ? { serviceId: id, planTier: tier } : { serviceId: id })
  }
  return Array.from(byId.values())
}

/**
 * Ensures `subscriptions` and `connectedServiceIds` agree. If only `connectedServiceIds` is
 * populated, migrations should run before this; otherwise ids are taken from subscriptions.
 */
export function withSyncedSubscriptionFields(state: DemoUserState): DemoUserState {
  const subs = dedupeSubscriptions(
    state.subscriptions.length > 0
      ? state.subscriptions
      : state.connectedServiceIds.map((serviceId) => ({ serviceId }))
  )
  const connectedServiceIds = subs.map((s) => s.serviceId)
  return {
    ...state,
    subscriptions: subs,
    connectedServiceIds,
  }
}

export function defaultDemoUserCore(): Omit<
  DemoUserState,
  "subscriptions" | "connectedServiceIds"
> {
  return {
    followedTeamIds: [...DEFAULT_FOLLOWED_TEAM_IDS],
    location: {
      city: "St. Louis",
      state: "MO",
      zipCode: "63101",
      marketLabel: "St. Louis market (Blues / Cardinals)",
    },
    preferences: {
      displayName: "Elliott",
      notificationsEnabled: true,
      darkMode: true,
      regionalLocationEnabled: true,
    },
  }
}

export const defaultDemoUserState: DemoUserState = withSyncedSubscriptionFields({
  subscriptions: [{ serviceId: "espn-plus" }, { serviceId: "team-radio" }],
  connectedServiceIds: [],
  ...defaultDemoUserCore(),
})

/**
 * Merge persisted JSON into a full `DemoUserState`.
 *
 * Migration:
 * - v2 / v1 objects with `subscriptions` array → normalize (empty array is valid).
 * - Legacy objects with only `connectedServiceIds` → lift to `{ serviceId }[]`.
 */
export function mergeDemoUserState(
  parsed: unknown,
  baseOverride?: DemoUserState
): DemoUserState {
  const base = baseOverride ?? defaultDemoUserState
  if (!isRecord(parsed)) return { ...base }

  const loc = isRecord(parsed.location) ? parsed.location : {}
  const prefs = isRecord(parsed.preferences) ? parsed.preferences : {}

  const subsFromField =
    "subscriptions" in parsed ? parseSubscriptionsArray(parsed.subscriptions) : undefined

  const legacyIds = Array.isArray(parsed.connectedServiceIds)
    ? parsed.connectedServiceIds.filter((id): id is string => typeof id === "string")
    : undefined

  const subscriptions: UserSubscription[] =
    subsFromField !== undefined
      ? subsFromField
      : legacyIds && legacyIds.length > 0
        ? legacyIds.map((serviceId) => ({ serviceId }))
        : [...base.subscriptions]

  const followedRaw = parsed.followedTeamIds
  const followedTeamIds: string[] =
    Array.isArray(followedRaw) && followedRaw.length > 0
      ? followedRaw.filter((id): id is string => typeof id === "string")
      : [...base.followedTeamIds]

  const draft: DemoUserState = {
    subscriptions,
    connectedServiceIds: [],
    followedTeamIds,
    location: {
      city: typeof loc.city === "string" ? loc.city : base.location.city,
      state: typeof loc.state === "string" ? loc.state : base.location.state,
      marketLabel:
        typeof loc.marketLabel === "string" ? loc.marketLabel : base.location.marketLabel,
      zipCode: typeof loc.zipCode === "string" ? loc.zipCode : base.location.zipCode,
      regionCode:
        typeof loc.regionCode === "string" ? loc.regionCode : base.location.regionCode,
    },
    preferences: {
      displayName:
        typeof prefs.displayName === "string"
          ? prefs.displayName
          : base.preferences.displayName,
      notificationsEnabled:
        typeof prefs.notificationsEnabled === "boolean"
          ? prefs.notificationsEnabled
          : base.preferences.notificationsEnabled,
      darkMode:
        typeof prefs.darkMode === "boolean"
          ? prefs.darkMode
          : base.preferences.darkMode,
      regionalLocationEnabled:
        typeof prefs.regionalLocationEnabled === "boolean"
          ? prefs.regionalLocationEnabled
          : base.preferences.regionalLocationEnabled,
    },
  }

  return withSyncedSubscriptionFields(draft)
}

/** Useful when simulating “what if user only had these service ids?” */
export function demoUserWithConnectedServiceIds(
  base: DemoUserState,
  serviceIds: string[]
): DemoUserState {
  return withSyncedSubscriptionFields({
    ...base,
    subscriptions: serviceIds.map((serviceId) => ({ serviceId })),
    connectedServiceIds: [...serviceIds],
  })
}

/** Resolved `Team` rows for the catalog ids on `state`. */
export function followedTeamsForState(
  state: DemoUserState,
  resolveTeams: (ids: readonly string[]) => Team[]
): Team[] {
  return resolveTeams(state.followedTeamIds)
}
