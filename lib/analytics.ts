/**
 * Lightweight product analytics — console/dev stub today; swap internals for PostHog, Segment, etc.
 * Use {@link trackEvent} and typed helpers; keep event names stable for downstream dashboards.
 */

import type { DemoUserState } from "@/lib/demo-user"

/** Flat primitive payload (forward-compatible with most browser analytics SDKs). */
export type AnalyticsPayload = Record<
  string,
  string | number | boolean | null | undefined
>

export type AnalyticsSourceScreen =
  | "home"
  | "schedule"
  | "game_detail"
  | "watch_stub"
  | "listen_stub"
  | "plans"
  | "plan_detail"
  | "upgrade_impact"
  | "assistant"
  | "promotions"
  | "settings_services"
  | "settings"
  | "teams"
  | "nav"
  | "unknown"

/** Canonical conversion / engagement event names (snake_case). */
export const AnalyticsEvent = {
  reviewPlanOptimizerClick: "review_plan_optimizer_click",
  comparePlansClick: "compare_plans_click",
  upgradeClick: "upgrade_click",
  connectedServicesClick: "connected_services_click",
  affiliateClick: "affiliate_click",
  assistantPromptSubmit: "assistant_prompt_submit",
  assistantSuggestedPromptClick: "assistant_suggested_prompt_click",
  watchActionClick: "watch_action_click",
  listenActionClick: "listen_action_click",
  /** Assistant / monetized cards: decision block rendered. */
  decisionShown: "decision_shown",
  /** Primary outcome CTA tap (any screen using shared conversion layer). */
  ctaPrimaryClick: "cta_primary_click",
  /** Secondary CTA tap (e.g. Review details → /plans). */
  ctaSecondaryClick: "cta_secondary_click",
} as const

function isAnalyticsDebug(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1"
  )
}

function scrubPayload(payload: AnalyticsPayload | undefined): AnalyticsPayload | undefined {
  if (!payload) return undefined
  const out: AnalyticsPayload = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue
    const t = typeof v
    if (t === "string" || t === "number" || t === "boolean" || v === null) {
      out[k] = v
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Fire a product event (client-only). Safe on SSR; no-ops when `window` is missing.
 * Later: delegate to PostHog `capture`, `dataLayer.push`, etc., in one place.
 */
export function trackEvent(eventName: string, payload?: AnalyticsPayload): void {
  if (typeof window === "undefined") return
  try {
    const body = scrubPayload(payload)
    const record = { event: eventName, ...body }
    if (isAnalyticsDebug()) {
      console.debug("[analytics]", record)
    }
    const w = window as Window & { dataLayer?: object[] }
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: eventName, ...body })
    }
  } catch {
    /* intentionally ignored — never break UX for analytics */
  }
}

/** Connected services slice for payloads (comma-separated ids, capped length). */
export function analyticsConnectedServices(state: DemoUserState): AnalyticsPayload {
  const ids = state.connectedServiceIds
  return {
    service_count: ids.length,
    connected_service_ids: ids.slice(0, 24).join(","),
  }
}

export function analyticsBase(
  sourceScreen: AnalyticsSourceScreen,
  state: DemoUserState,
  extra?: AnalyticsPayload
): AnalyticsPayload {
  return {
    source_screen: sourceScreen,
    ...analyticsConnectedServices(state),
    ...extra,
  }
}

/**
 * Outbound partner / affiliate taps. Prefer passing:
 * - `service_id` — streaming entitlement key (e.g. espn-plus)
 * - `plan_id` — optimizer plan id when the click is plan-scoped
 * - `intent` — short funnel label (e.g. assistant_plan, plans_start_plan)
 */
export function trackAffiliateClick(
  url: string,
  sourceScreen: AnalyticsSourceScreen,
  state: DemoUserState,
  extra?: AnalyticsPayload
): void {
  let host: string | undefined
  try {
    host = new URL(url).hostname
  } catch {
    host = undefined
  }
  trackEvent(AnalyticsEvent.affiliateClick, {
    ...analyticsBase(sourceScreen, state, extra),
    href: url,
    ...(host ? { outbound_host: host } : {}),
  })
}

/** Listen/outbound audio: use {@link AnalyticsEvent.affiliateClick} when URL looks partner/UTM-tagged. */
export function trackListenOutbound(
  url: string,
  sourceScreen: AnalyticsSourceScreen,
  state: DemoUserState,
  extra?: AnalyticsPayload
): void {
  const lower = url.toLowerCase()
  const maybeAffiliate = /utm_|affiliate|partner|\bref=/.test(lower)
  if (maybeAffiliate) {
    trackAffiliateClick(url, sourceScreen, state, {
      ...extra,
      label: (extra?.label as string | undefined) ?? "listen_outbound",
    })
    return
  }
  trackEvent(AnalyticsEvent.listenActionClick, {
    ...analyticsBase(sourceScreen, state, extra),
    href: url,
  })
}

/** Route Assistant primary/secondary CTAs to the right event without duplicating heuristics in the page. */
export function trackAssistantNavigationClick(
  state: DemoUserState,
  href: string | undefined,
  label: string
): void {
  if (!href) return
  const base = analyticsBase("assistant", state, { href, label })
  if (href.includes("/settings/services")) {
    trackEvent(AnalyticsEvent.connectedServicesClick, base)
    return
  }
  if (href.includes("/plans/upgrade/")) {
    const upgradeId = href.split("/plans/upgrade/")[1]?.split("?")[0]
    trackEvent(AnalyticsEvent.upgradeClick, {
      ...base,
      ...(upgradeId ? { upgrade_id: upgradeId } : {}),
    })
    return
  }
  if (href.startsWith("/plans")) {
    const rest = href.replace(/^\/plans\/?/, "").split("?")[0]
    trackEvent(AnalyticsEvent.comparePlansClick, {
      ...base,
      ...(rest ? { plan_id: rest } : {}),
    })
    return
  }
  if (href.startsWith("/game/")) {
    trackEvent(AnalyticsEvent.watchActionClick, {
      ...base,
      game_id: href.replace("/game/", "").split("?")[0],
    })
  }
}
