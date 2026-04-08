/**
 * Lightweight keyword intent routing for the Assistant (no NLP / no LLM).
 */

import type { DemoUserState } from "@/lib/demo-user"
import type { OptimizerScope } from "@/lib/optimizer-plans"

export type AssistantIntentKind =
  | "watch-question"
  | "plan-question"
  | "missing-games"
  | "unknown"

export interface ParsedAssistantQuery {
  intent: AssistantIntentKind
  gameId?: string
  scope?: OptimizerScope
}

/** Demo schedule: tonight Blues home → game-1; tonight Cardinals home → game-2 */
const DEMO_GAME_BLUES = "game-1"
const DEMO_GAME_CARDINALS = "game-2"

function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
}

function hasWordBlues(n: string): boolean {
  return /\bblues\b/.test(n)
}

function hasWordCardinals(n: string): boolean {
  return /\bcardinals\b/.test(n) || /\bcardinal\b/.test(n)
}

function inferScope(n: string): OptimizerScope {
  const blues = hasWordBlues(n)
  const cards = hasWordCardinals(n)
  if (blues && cards) return "both"
  if (blues) return "blues"
  if (cards) return "cardinals"
  return "both"
}

/** Watch intent: game id for demo Blues/Cardinals tonight’s games. */
function inferWatchGameId(n: string): string | undefined {
  const blues = hasWordBlues(n)
  const cards = hasWordCardinals(n)
  if (cards && !blues) return DEMO_GAME_CARDINALS
  if (blues) return DEMO_GAME_BLUES
  return undefined
}

function isMissingIntent(n: string): boolean {
  if (n.includes("missing")) return true
  if (n.includes("what am i missing")) return true
  if (n.includes("this week")) return true
  return false
}

function isPlanIntent(n: string): boolean {
  if (n.includes("cheapest")) return true
  if (n.includes("best plan")) return true
  if (n.includes("what should i get")) return true
  return false
}

function isWatchIntent(n: string): boolean {
  if (n.includes("can i watch")) return true
  if (n.includes("why can't i watch") || n.includes("why cant i watch")) return true
  if (/\bwatch\b/.test(n)) return true
  return false
}

/**
 * Map free-form text to a structured intent for `assistant-engine` callers.
 * `userState` is reserved for future context (e.g. locale, defaults); routing is keyword-only today.
 */
export function parseAssistantQuery(
  input: string,
  _userState: DemoUserState
): ParsedAssistantQuery {
  const n = normalize(input)

  if (n.length === 0) {
    return { intent: "unknown" }
  }

  if (isMissingIntent(n)) {
    return { intent: "missing-games", scope: inferScope(n) }
  }

  if (isPlanIntent(n)) {
    return { intent: "plan-question", scope: inferScope(n) }
  }

  if (isWatchIntent(n)) {
    return {
      intent: "watch-question",
      gameId: inferWatchGameId(n),
    }
  }

  return { intent: "unknown" }
}
