/**
 * Demo “open watch” routing: in-app stub explains next steps + optional link to a public provider entry page.
 * Real products would deep-link or universal-link into provider apps.
 */

import { serviceDisplayName } from "@/lib/streaming-service-ids"

/** Credible public entry points for demo outbound clicks (not affiliate-tracked unless URL carries UTM). */
export const DEMO_PROVIDER_WATCH_HOME_URL: Record<string, string> = {
  "espn-plus": "https://www.espn.com/espnplus/",
  max: "https://www.max.com/",
  "fanduel-sports": "https://www.fanduelsportsnetwork.com/",
  "mlb-tv": "https://www.mlb.com/live-stream-games/",
  "nhl-tv": "https://www.nhl.com/tv/",
  directv: "https://www.directv.com/stream/",
  "youtube-tv": "https://tv.youtube.com/welcome/",
}

export function providerWatchHomeUrl(serviceId: string): string | undefined {
  return DEMO_PROVIDER_WATCH_HOME_URL[serviceId]
}

/**
 * In-app stub: `/watch/{serviceId}?gameId=…` — use `demo` when no canonical id is known.
 */
export function watchStubPath(serviceId: string | undefined, gameId: string): string {
  const seg =
    serviceId && serviceId.length > 0 ? encodeURIComponent(serviceId) : "demo"
  return `/watch/${seg}?gameId=${encodeURIComponent(gameId)}`
}

/** Primary CTA label on Game Detail when video is available. */
export function watchOpenButtonLabel(serviceId: string | undefined): string {
  if (!serviceId) return "How to watch"
  return `Open ${serviceDisplayName(serviceId)}`
}
