/**
 * Presentation-only formatting for Assistant UI (decision / why / next).
 * Does not change engine answer shapes or resolver/optimizer logic.
 */

import type {
  MissingGamesAnswer,
  PlanQuestionAnswer,
  WatchQuestionAnswer,
} from "@/lib/assistant-engine"
import { userTeams, getEngineGames } from "@/lib/data"
import type { DemoUserState } from "@/lib/demo-user"
import {
  calculateIncrementalPlanValue,
  getCurrentCoverageBaseline,
} from "@/lib/optimizer-engine"
import {
  getAffiliateLink,
  hasAffiliateLanding,
  primaryAffiliateServiceIdForPlan,
  resolvePrimaryVideoServiceIdForGame,
} from "@/lib/affiliate"
import {
  getOptimizerPlanById,
  type OptimizerPlan,
  type OptimizerScope,
} from "@/lib/optimizer-plans"
import { serviceDisplayName } from "@/lib/streaming-service-ids"
import {
  chooseMonetizedPrimaryLabel,
  isGameWithinHours,
  labelGetBestValuePlan,
  labelReviewDetails,
  labelSeeHomeSchedule,
  labelUnlockMoreGames,
  labelWatchTonightsGame,
  missTonightUrgencyLine,
  seasonUnlockBanner,
  socialProofMostFans,
  socialProofRecommended,
  URGENCY_HOURS,
  urgencyTeamLabel,
  valueJustificationBestValue,
  valueJustificationCheapest,
} from "@/lib/conversion-copy"

const MAX_WHY = 2

function decisionMentionsUnlockCount(decision: string): number | null {
  const m = decision.match(/Unlocks\s+(\d+)\s+more games/i)
  return m ? Number(m[1]) : null
}

function decisionMentionsCoverageArrow(decision: string): {
  before: number
  after: number
} | null {
  const m = decision.match(/(\d+)%\s*→\s*(\d+)%/)
  if (!m) return null
  return { before: Number(m[1]), after: Number(m[2]) }
}

/**
 * Drops Why lines that repeat unlock counts or coverage deltas already stated in Decision.
 */
function filterWhyVsDecision(
  decision: string | undefined,
  lines: string[]
): string[] {
  if (!decision) return lines
  const nUnlock = decisionMentionsUnlockCount(decision)
  const arrow = decisionMentionsCoverageArrow(decision)
  return lines.filter((line) => {
    if (nUnlock !== null) {
      const um = line.match(/Unlocks\s+(\d+)\s+more games/i)
      if (um && Number(um[1]) === nUnlock) return false
    }
    if (arrow) {
      if (
        line.includes(`${arrow.before}%`) &&
        line.includes(`${arrow.after}%`) &&
        (line.includes("→") || line.includes("coverage"))
      ) {
        return false
      }
    }
    const only = line.match(/You only have (\d+)% coverage this season\.?/i)
    if (only && arrow && Number(only[1]) === arrow.before) return false
    return true
  })
}

function parsePrefixedLine(
  reasons: string[],
  prefix: string
): string | null {
  const r = reasons.find((x) => x.startsWith(prefix))
  if (!r) return null
  return r.slice(prefix.length).replace(/\.$/, "").trim()
}

function firstListItem(line: string | null): string | null {
  if (!line) return null
  const first = line.split(",")[0]?.trim()
  return first || null
}

function stripWatchOnPrefix(label: string): string {
  return label.replace(/^\s*watch\s+on\s+/i, "").trim() || label
}

function userTeamIdSet(): Set<string> {
  return new Set(userTeams.map((t) => t.id))
}

function watchGameUrgency(
  gameId: string | undefined,
  now = new Date()
): { within24h: boolean; line: string | null } {
  if (!gameId) return { within24h: false, line: null }
  const game = getEngineGames().find((g) => g.id === gameId)
  if (!game) return { within24h: false, line: null }
  const within = isGameWithinHours(game.dateTime, URGENCY_HOURS, now)
  if (within) {
    return {
      within24h: true,
      line: missTonightUrgencyLine(urgencyTeamLabel(game, userTeamIdSet())),
    }
  }
  return { within24h: false, line: null }
}

export function formatAssistantDecision(
  input:
    | { kind: "watch"; payload: WatchQuestionAnswer; gameId?: string }
    | {
        kind: "plan"
        payload: PlanQuestionAnswer
        scope: OptimizerScope
        userState: DemoUserState
      }
    | { kind: "missing"; payload: MissingGamesAnswer }
    | { kind: "fallback"; headline: string }
): string {
  if (input.kind === "fallback") {
    return input.headline
  }

  if (input.kind === "watch") {
    const p = input.payload
    const { within24h, line: urgencyLine } = watchGameUrgency(
      input.gameId,
      new Date()
    )
    if (p.headline === "Game not found") {
      return p.headline
    }
    if (p.status === "watchable") {
      const feeds = parsePrefixedLine(p.reasons, "Feeds: ")
      const video = parsePrefixedLine(p.reasons, "Video: ")
      const via = firstListItem(feeds) ?? (video ? stripWatchOnPrefix(video) : null)
      const core = via
        ? `You can watch this on ${via}.`
        : "You can watch this with your current setup."
      if (urgencyLine) return `${urgencyLine}\n\n${core}`
      return core
    }
    const core = "You can’t watch this with your current setup."
    if (urgencyLine) return `${urgencyLine}\n\n${core}`
    if (!within24h) return `${seasonUnlockBanner()} — ${core}`
    return core
  }

  if (input.kind === "plan") {
    const { payload, scope, userState } = input
    const bestId = payload.recommendations.bestValuePlanId
    const best = bestId ? getOptimizerPlanById(bestId) : undefined
    if (best) {
      const inc = calculateIncrementalPlanValue(best, scope, userState)
      const baseline = getCurrentCoverageBaseline(scope, userState)
      const before = baseline.coveragePercent
      const after = best.coveragePercent
      let impact = ""
      if (inc.newlyWatchableGames > 0 && before > 0 && after > before) {
        const ratio = after / before
        const times =
          ratio >= 1.95 ? `${Math.round(ratio)}×` : `~${ratio.toFixed(1)}×`
        impact = ` Unlocks ${inc.newlyWatchableGames} more games (${before}% → ${after}% coverage, ${times}).`
      } else if (inc.newlyWatchableGames > 0) {
        impact = ` Unlocks ${inc.newlyWatchableGames} more games.`
      }
      return `Best move: ${best.name}.${impact}`
    }
    const cheapId = payload.recommendations.cheapestPlanId
    const cheap = cheapId ? getOptimizerPlanById(cheapId) : undefined
    if (cheap) {
      return `Best move: start with ${cheap.name}.`
    }
    return "Review details in Plan Optimizer."
  }

  const m = input.payload
  if (m.missingGames.length === 0) {
    const { gamesWatchable, totalGames, coveragePercent } = m.baseline
    return `You can watch ${gamesWatchable} of ${totalGames} games this season (${coveragePercent}% coverage).`
  }
  const head =
    m.baseline.coveragePercent < 50
      ? "You’re missing most of your games."
      : "You’re missing full video on several games."
  const plan = m.upgradeHint.planId
    ? getOptimizerPlanById(m.upgradeHint.planId)
    : undefined
  if (
    plan &&
    m.upgradeHint.unlockMoreGamesThisSeason > 0 &&
    m.baseline.coveragePercent > 0 &&
    plan.coveragePercent > m.baseline.coveragePercent
  ) {
    const before = m.baseline.coveragePercent
    const after = plan.coveragePercent
    const ratio = after / before
    const times =
      ratio >= 1.95 ? `${Math.round(ratio)}×` : `~${ratio.toFixed(1)}×`
    return `${head} ${m.upgradeHint.planName ?? plan.name} unlocks ${m.upgradeHint.unlockMoreGamesThisSeason} more games (${before}% → ${after}% coverage, ${times}).`
  }
  if (m.upgradeHint.unlockMoreGamesThisSeason > 0 && m.upgradeHint.planName) {
    return `${head} ${m.upgradeHint.planName} unlocks ${m.upgradeHint.unlockMoreGamesThisSeason} more games.`
  }
  return head
}

export function formatAssistantWhy(
  input:
    | { kind: "watch"; payload: WatchQuestionAnswer }
    | {
        kind: "plan"
        payload: PlanQuestionAnswer
        scope: OptimizerScope
        userState: DemoUserState
        /** When set, Why lines that repeat Decision metrics are removed. */
        decisionText?: string
      }
    | {
        kind: "missing"
        payload: MissingGamesAnswer
        userState: DemoUserState
        decisionText?: string
      }
    | { kind: "fallback"; summary?: string }
): string[] {
  if (input.kind === "fallback") {
    const s = input.summary?.trim()
    return s ? [s] : []
  }

  if (input.kind === "watch") {
    const p = input.payload
    const out: string[] = []

    if (p.headline === "Game not found") {
      return p.reasons.slice(0, MAX_WHY)
    }

    if (p.status === "watchable") {
      const feeds = parsePrefixedLine(p.reasons, "Feeds: ")
      const video = parsePrefixedLine(p.reasons, "Video: ")
      if (feeds?.includes(",")) {
        const parts = feeds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        const primary = firstListItem(feeds)
        const rest = parts.filter(
          (x) => !primary || x.toLowerCase() !== primary.toLowerCase()
        )
        if (rest.length > 0) {
          out.push(`Also covers ${rest.join(", ")}.`)
        }
      } else if (feeds && video) {
        const v = stripWatchOnPrefix(video)
        if (feeds.toLowerCase() !== v.toLowerCase()) {
          out.push(`Covers ${feeds}.`)
        }
      } else if (video && !feeds) {
        out.push(`Covers ${stripWatchOnPrefix(video)}.`)
      }
      return out.slice(0, MAX_WHY)
    }

    const fix = p.reasons.find(
      (r) =>
        r &&
        !r.startsWith("Video:") &&
        !r.includes("still available") &&
        r !== "Not available with your current plan"
    )
    if (fix) {
      out.push(fix.endsWith(".") ? fix : `${fix}.`)
    } else {
      const planCopy = p.reasons.find((r) => r.includes("current plan"))
      if (planCopy) out.push("Video isn’t included with your services.")
    }

    const listenLine = p.reasons.find((r) => r.includes("still available"))
    if (listenLine && p.status === "listen-only") {
      const short = listenLine.replace(/\s+is still available\.?$/, "").trim()
      if (short) out.push(`Audio: ${short.endsWith(".") ? short : `${short}.`}`)
    }

    return dedupeWhy(out).slice(0, MAX_WHY)
  }

  if (input.kind === "plan") {
    const { payload, scope, userState, decisionText } = input
    const out: string[] = []
    const bestId = payload.recommendations.bestValuePlanId
    const best = bestId ? getOptimizerPlanById(bestId) : undefined
    const fullId = payload.recommendations.fullCoveragePlanId
    const full = fullId ? getOptimizerPlanById(fullId) : undefined

    let unlockInDecision = false
    if (best) {
      const inc = calculateIncrementalPlanValue(best, scope, userState)
      const baseline = getCurrentCoverageBaseline(scope, userState)
      unlockInDecision =
        inc.newlyWatchableGames > 0 && best.coveragePercent > baseline.coveragePercent
    }

    if (
      best &&
      full &&
      best.monthlyCost < full.monthlyCost &&
      best.id !== full.id
    ) {
      out.push("Avoids paying for Full Coverage.")
    }

    if (!unlockInDecision && best) {
      const inc = calculateIncrementalPlanValue(best, scope, userState)
      if (inc.newlyWatchableGames > 0) {
        const baseline = getCurrentCoverageBaseline(scope, userState)
        const after = best.coveragePercent
        const before = baseline.coveragePercent
        if (after > before) {
          out.push(
            `Unlocks ${inc.newlyWatchableGames} more games (${before}% → ${after}% coverage).`
          )
        } else {
          out.push(`Unlocks ${inc.newlyWatchableGames} more games this season.`)
        }
      }
    }

    if (
      out.length === 0 &&
      payload.recommendations.cheapestPlanId &&
      (!best || payload.recommendations.cheapestPlanId !== best.id)
    ) {
      const cheap = getOptimizerPlanById(payload.recommendations.cheapestPlanId)
      if (cheap) {
        const inc = calculateIncrementalPlanValue(cheap, scope, userState)
        if (inc.newlyWatchableGames > 0) {
          out.push(`Cheapest adds ${inc.newlyWatchableGames} watchable games.`)
        }
      }
    }

    const monthly = payload.reasons.find((r) =>
      r.startsWith("Your estimated monthly spend")
    )
    if (out.length < MAX_WHY && monthly) {
      out.push(monthly.endsWith(".") ? monthly : `${monthly}.`)
    }

    return dedupeWhy(filterWhyVsDecision(decisionText, out)).slice(0, MAX_WHY)
  }

  const { payload, userState, decisionText } = input
  const out: string[] = []

  if (payload.missingGames.length === 0) {
    return dedupeWhy(filterWhyVsDecision(decisionText, out)).slice(0, MAX_WHY)
  }

  const unwatched = Math.max(
    0,
    payload.baseline.totalGames - payload.baseline.gamesWatchable
  )

  const planId = payload.upgradeHint.planId
  const plan = planId ? getOptimizerPlanById(planId) : undefined
  let topService: string | null = null
  let incrementalCostLine: string | null = null
  if (plan) {
    const inc = calculateIncrementalPlanValue(
      plan,
      payload.baseline.scope,
      userState
    )
    const sid = inc.incrementalServices[0]
    topService = sid ? serviceDisplayName(sid) : null
    if (payload.upgradeHint.incrementalCost > 0) {
      incrementalCostLine = `About +$${payload.upgradeHint.incrementalCost.toFixed(2)}/mo vs your priced services for that upgrade.`
    }
  }

  if (topService) {
    out.push(`Most added games need ${topService}.`)
  } else if (payload.upgradeHint.planName) {
    out.push(`${payload.upgradeHint.planName} adds the biggest coverage jump.`)
  } else if (unwatched > 0) {
    out.push(
      `You’re missing ${unwatched} game${unwatched === 1 ? "" : "s"} this season without full video.`
    )
  }

  if (out.length < MAX_WHY && incrementalCostLine) {
    out.push(incrementalCostLine)
  }

  if (out.length < MAX_WHY) {
    out.push(
      `You only have ${payload.baseline.coveragePercent}% coverage this season.`
    )
  }

  return dedupeWhy(filterWhyVsDecision(decisionText, out)).slice(0, MAX_WHY)
}

export interface AffiliateClickMeta {
  serviceId: string
  planId?: string
  intent: string
}

export interface FormattedAssistantAction {
  label: string
  href?: string
  /** Present when `href` is an outbound affiliate URL (analytics). */
  affiliate?: AffiliateClickMeta
}

export interface FormattedAssistantNextAction {
  primary: FormattedAssistantAction
  secondary?: FormattedAssistantAction
  valueJustification?: string
  socialProof?: string
}

function valueAndSocialForPlan(plan: OptimizerPlan | undefined): {
  value: string
  social: string
} {
  const value =
    plan?.tier === "cheapest"
      ? valueJustificationCheapest()
      : valueJustificationBestValue()
  const social =
    plan?.tier === "value" || plan?.name === "Best Value"
      ? socialProofMostFans()
      : socialProofRecommended()
  return { value, social }
}

const WATCH_VALUE_SOCIAL = {
  value: valueJustificationBestValue(),
  social: socialProofRecommended(),
} as const

function topIncrementalServiceId(
  payload: MissingGamesAnswer,
  userState: DemoUserState
): string | null {
  const planId = payload.upgradeHint.planId
  const plan = planId ? getOptimizerPlanById(planId) : undefined
  if (!plan) return null
  const inc = calculateIncrementalPlanValue(
    plan,
    payload.baseline.scope,
    userState
  )
  const sid = inc.incrementalServices[0]
  return sid ?? null
}

function topIncrementalServiceLabel(
  payload: MissingGamesAnswer,
  userState: DemoUserState
): string | null {
  const sid = topIncrementalServiceId(payload, userState)
  return sid ? serviceDisplayName(sid) : null
}

export function formatAssistantNextAction(
  input:
    | { kind: "watch"; payload: WatchQuestionAnswer; gameId?: string }
    | {
        kind: "plan"
        payload: PlanQuestionAnswer
        scope: OptimizerScope
        userState: DemoUserState
      }
    | { kind: "missing"; payload: MissingGamesAnswer; userState: DemoUserState }
    | { kind: "fallback" }
): FormattedAssistantNextAction {
  if (input.kind === "fallback") {
    return { primary: { label: "Ask a question below", href: undefined } }
  }

  if (input.kind === "watch") {
    const p = input.payload
    const gid = input.gameId
    const { within24h } = watchGameUrgency(gid, new Date())
    if (p.headline === "Game not found") {
      return {
        primary: { ...p.primaryAction },
        valueJustification: WATCH_VALUE_SOCIAL.value,
        socialProof: WATCH_VALUE_SOCIAL.social,
      }
    }

    if (p.status === "watchable") {
      return {
        primary: {
          label: within24h ? labelWatchTonightsGame() : "Open your stream",
          href: p.primaryAction.href,
        },
        secondary: {
          label: labelReviewDetails(),
          href: "/plans",
        },
        valueJustification: WATCH_VALUE_SOCIAL.value,
        socialProof: WATCH_VALUE_SOCIAL.social,
      }
    }

    const videoSid = gid ? resolvePrimaryVideoServiceIdForGame(gid) : undefined
    const { value, social } = valueAndSocialForPlan(undefined)

    if (p.status === "listen-only") {
      const affiliatePrimary =
        videoSid && hasAffiliateLanding(videoSid)
          ? {
              label: chooseMonetizedPrimaryLabel({
                within24h,
                planName: "",
              }),
              href: getAffiliateLink(videoSid, {
                sourceScreen: "assistant",
                intent: "assistant_watch_listen_only",
              }),
              affiliate: {
                serviceId: videoSid,
                intent: "assistant_watch_listen_only",
              },
            }
          : null

      if (affiliatePrimary) {
        return {
          primary: affiliatePrimary,
          secondary: {
            label: "Listen free now",
            href: p.primaryAction.href,
          },
          valueJustification: value,
          socialProof: social,
        }
      }

      return {
        primary: { label: "Listen free now", href: p.primaryAction.href },
        secondary: {
          label: labelReviewDetails(),
          href: "/plans",
        },
        valueJustification: value,
        socialProof: social,
      }
    }

    if (videoSid && hasAffiliateLanding(videoSid)) {
      return {
        primary: {
          label: chooseMonetizedPrimaryLabel({
            within24h,
            planName: "",
          }),
          href: getAffiliateLink(videoSid, {
            sourceScreen: "assistant",
            intent: "assistant_watch_not_available",
          }),
          affiliate: {
            serviceId: videoSid,
            intent: "assistant_watch_not_available",
          },
        },
        secondary: {
          label: labelReviewDetails(),
          href: "/plans",
        },
        valueJustification: value,
        socialProof: social,
      }
    }

    return {
      primary: { label: labelUnlockMoreGames(), href: p.primaryAction.href },
      secondary: {
        label: labelReviewDetails(),
        href: "/plans",
      },
      valueJustification: value,
      socialProof: social,
    }
  }

  if (input.kind === "plan") {
    const { payload, scope, userState } = input
    const bestId = payload.recommendations.bestValuePlanId
    const best = bestId ? getOptimizerPlanById(bestId) : undefined
    const lead = best ? primaryAffiliateServiceIdForPlan(best) : undefined
    const { value, social } = valueAndSocialForPlan(best ?? undefined)
    if (lead && hasAffiliateLanding(lead)) {
      return {
        primary: {
          label: chooseMonetizedPrimaryLabel({
            within24h: false,
            planName: best?.name ?? "",
          }),
          href: getAffiliateLink(lead, {
            sourceScreen: "assistant",
            intent: "assistant_plan",
            planId: best?.id,
          }),
          affiliate: {
            serviceId: lead,
            planId: best?.id,
            intent: "assistant_plan",
          },
        },
        secondary: {
          label: labelReviewDetails(),
          href: "/plans",
        },
        valueJustification: value,
        socialProof: social,
      }
    }
    return {
      primary: {
        label: labelReviewDetails(),
        href: "/plans",
      },
      valueJustification: value,
      socialProof: social,
    }
  }

  const p = input.payload
  const svc = topIncrementalServiceLabel(p, input.userState)
  const svcId = topIncrementalServiceId(p, input.userState)
  const planEntity =
    p.upgradeHint.planId != null
      ? getOptimizerPlanById(p.upgradeHint.planId)
      : undefined

  const { value, social } = valueAndSocialForPlan(planEntity ?? undefined)

  const upgradeLabel =
    p.upgradeHint.planName === "Best Value"
      ? labelGetBestValuePlan()
      : labelUnlockMoreGames()

  if (p.missingGames.length > 0 && svcId && hasAffiliateLanding(svcId)) {
    return {
      primary: {
        label: chooseMonetizedPrimaryLabel({
          within24h: false,
          planName: p.upgradeHint.planName ?? planEntity?.name ?? "",
        }),
        href: getAffiliateLink(svcId, {
          sourceScreen: "assistant",
          intent: "assistant_missing",
          planId: planEntity?.id,
        }),
        affiliate: {
          serviceId: svcId,
          planId: planEntity?.id,
          intent: "assistant_missing",
        },
      },
      secondary: {
        label: labelReviewDetails(),
        href: "/plans",
      },
      valueJustification: value,
      socialProof: social,
    }
  }

  return {
    primary: {
      label: p.missingGames.length > 0 ? upgradeLabel : labelSeeHomeSchedule(),
      href: p.primaryAction.href,
    },
    secondary:
      p.missingGames.length > 0
        ? {
            label: labelReviewDetails(),
            href: "/plans",
          }
        : undefined,
    valueJustification: value,
    socialProof: social,
  }
}

function dedupeWhy(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of items) {
    const k = t.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}
