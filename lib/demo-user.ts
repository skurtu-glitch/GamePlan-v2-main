export interface DemoLocation {
  city: string
  state: string
  /** Broadcast / market label for demo scenarios */
  marketLabel?: string
}

export interface DemoUserPreferences {
  displayName: string
}

export interface DemoUserState {
  connectedServiceIds: string[]
  location: DemoLocation
  preferences: DemoUserPreferences
}

export const DEMO_USER_STORAGE_KEY = "gameplan-demo-user-v1"

export const defaultDemoUserState: DemoUserState = {
  connectedServiceIds: ["espn-plus", "team-radio"],
  location: {
    city: "St. Louis",
    state: "MO",
    marketLabel: "St. Louis market (Blues / Cardinals)",
  },
  preferences: {
    displayName: "Elliott",
  },
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null
}

export function mergeDemoUserState(parsed: unknown): DemoUserState {
  const base = defaultDemoUserState
  if (!isRecord(parsed)) return { ...base }

  const loc = isRecord(parsed.location) ? parsed.location : {}
  const prefs = isRecord(parsed.preferences) ? parsed.preferences : {}

  return {
    connectedServiceIds: Array.isArray(parsed.connectedServiceIds)
      ? parsed.connectedServiceIds.filter((id): id is string => typeof id === "string")
      : [...base.connectedServiceIds],
    location: {
      city: typeof loc.city === "string" ? loc.city : base.location.city,
      state: typeof loc.state === "string" ? loc.state : base.location.state,
      marketLabel:
        typeof loc.marketLabel === "string" ? loc.marketLabel : base.location.marketLabel,
    },
    preferences: {
      displayName:
        typeof prefs.displayName === "string" ? prefs.displayName : base.preferences.displayName,
    },
  }
}
