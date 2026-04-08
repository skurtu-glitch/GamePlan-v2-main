export type Sport = "NHL" | "MLB" | "NFL" | "NBA"

export interface Team {
  id: string
  name: string
  city: string
  abbreviation: string
  sport: Sport
  primaryColor: string
  logo: string
}

export type AvailabilityStatus = "available" | "unavailable" | "partial"

export interface MediaAvailability {
  status: AvailabilityStatus
  provider?: string
  /** Connected-service ids that unlock this feed (e.g. espn-plus, fanduel-sports). */
  providers?: string[]
  note?: string
}

// Personalized access status
export type AccessStatus = "watchable" | "unavailable" | "upgrade"

export interface ActionOption {
  label: string
  type: "add" | "upgrade" | "open" | "view"
  provider?: string
  price?: string
}

export interface PersonalizedAccess {
  status: AccessStatus
  reason: string
  actions: ActionOption[]
  bestOption: {
    label: string
    action: ActionOption
  }
}

export interface Game {
  id: string
  homeTeam: Team
  awayTeam: Team
  dateTime: string
  watch: MediaAvailability
  listen: MediaAvailability
  recommendation: "Watch" | "Just Listen" | "Unavailable"
  venue?: string
  access?: PersonalizedAccess
}

export interface StreamingPlan {
  id: string
  name: string
  price: number
  priceUnit: "month" | "year"
  channels: string[]
  sports: Sport[]
  pros: string[]
  cons: string[]
}

// Extended game detail types
export interface WatchOption {
  provider: string
  available: boolean
  reason: string
  hasSubscription?: boolean
  price?: string
}

export interface ListenFeed {
  name: string
  type: "home" | "away" | "national"
  provider: string
  free: boolean
  url?: string
}

/**
 * Game row for detail route: `Game` + curated `listenFeeds`.
 *
 * **Watch / access UI:** use `resolveGameAccess` + `formatGameDetailAccess` — do not rely on the
 * deprecated optional fields below for primary rendering.
 *
 * @deprecated `watchVerdict` — use formatted access from `formatGameDetailAccess`.
 * @deprecated `watchOptions` — use formatted access from `formatGameDetailAccess`.
 * @deprecated `bestOption` — use formatted access from `formatGameDetailAccess`.
 * @deprecated `whyThisAnswer` — use formatted access from `formatGameDetailAccess`.
 */
export interface GameDetail extends Game {
  listenFeeds: ListenFeed[]

  /** @deprecated Use `formatGameDetailAccess(...).watchVerdict` */
  watchVerdict?: {
    canWatch: boolean
    summary: string
    reasons: string[]
  }
  /** @deprecated Use `formatGameDetailAccess(...).watchOptions` */
  watchOptions?: WatchOption[]
  /** @deprecated Use `formatGameDetailAccess(...).bestOption` */
  bestOption?: {
    type: "watch" | "listen"
    provider: string
    explanation: string
  }
  /** @deprecated Use `formatGameDetailAccess(...).whyThisAnswer` */
  whyThisAnswer?: string[]
}
