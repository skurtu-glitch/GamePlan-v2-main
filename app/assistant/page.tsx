"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import { useSchedule } from "@/components/providers/schedule-provider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Send,
  Sparkles,
  Calendar,
  ChevronRight,
  TrendingUp,
  MessageCircle,
} from "lucide-react"
import { parseAssistantQuery } from "@/lib/assistant-intents"
import {
  answerMissingGamesQuestion,
  answerPlanQuestion,
  answerWatchQuestion,
  createSuggestedPrompts,
  type MissingGamesAnswer,
  type PlanQuestionAnswer,
  type WatchQuestionAnswer,
} from "@/lib/assistant-engine"
import {
  formatAssistantDecision,
  formatAssistantNextAction,
  formatAssistantWhy,
} from "@/lib/assistant-format"
import type { DemoUserState } from "@/lib/demo-user"
import { teamsForFollowedIds } from "@/lib/data"
import { getCurrentUserCoverageSummary } from "@/lib/current-user-coverage"
import type { OptimizerScope } from "@/lib/optimizer-plans"
import { formatServiceIdList } from "@/lib/streaming-service-ids"
import {
  AnalyticsEvent,
  analyticsBase,
  trackAffiliateClick,
  trackAssistantNavigationClick,
  trackEvent,
} from "@/lib/analytics"
import type { AffiliateClickMeta } from "@/lib/assistant-format"

/** Icon hints for generic prompts; team-specific lines come from {@link createSuggestedPrompts}. */
const DEMO_SUGGESTED_PROMPTS = [
  { icon: TrendingUp, text: "What's the cheapest way to watch more games?" },
  { icon: Calendar, text: "What am I missing on video?" },
] as const

const ICON_BY_PROMPT_TEXT: Record<string, LucideIcon> = Object.fromEntries(
  DEMO_SUGGESTED_PROMPTS.map((p) => [p.text, p.icon])
)

type AssistantIntent = "watch" | "plan" | "missing" | "fallback"

function normalizePromptKey(s: string): string {
  return s.trim().toLowerCase().replace(/\u2019/g, "'").replace(/\u2018/g, "'")
}

/** Engine-first starter list, then any demo prompts not already included (icons mapped when known). */
function mergedStarterPrompts(userState: DemoUserState): { text: string; icon: LucideIcon }[] {
  const seen = new Set<string>()
  const out: { text: string; icon: LucideIcon }[] = []

  for (const p of createSuggestedPrompts(userState)) {
    const key = normalizePromptKey(p.text)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ text: p.text, icon: ICON_BY_PROMPT_TEXT[p.text] ?? Sparkles })
  }
  for (const p of DEMO_SUGGESTED_PROMPTS) {
    const key = normalizePromptKey(p.text)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ text: p.text, icon: p.icon })
  }
  return out
}

const FOLLOWUP_AFTER_WATCH: { text: string; icon: LucideIcon }[] = [
  { text: "What’s the cheapest way to watch more games?", icon: TrendingUp },
  { text: "What am I missing on video?", icon: Calendar },
]

const FOLLOWUP_AFTER_PLAN: { text: string; icon: LucideIcon }[] = [
  { text: "What’s the cheapest upgrade?", icon: TrendingUp },
  {
    text: "What would I miss without full coverage, and what’s the cheapest upgrade?",
    icon: MessageCircle,
  },
]

const FOLLOWUP_AFTER_MISSING: { text: string; icon: LucideIcon }[] = [
  { text: "What should I get first?", icon: Sparkles },
  { text: "What’s the cheapest upgrade?", icon: TrendingUp },
]

function followUpPrompts(
  userState: DemoUserState,
  lastUserMessage: string | undefined,
  lastIntent: AssistantIntent | undefined
): { text: string; icon: LucideIcon }[] {
  const last = lastUserMessage ? normalizePromptKey(lastUserMessage) : ""

  let pool: { text: string; icon: LucideIcon }[]

  if (lastIntent === "watch") {
    pool = [...FOLLOWUP_AFTER_WATCH]
  } else if (lastIntent === "plan") {
    pool = [...FOLLOWUP_AFTER_PLAN]
  } else if (lastIntent === "missing") {
    pool = [...FOLLOWUP_AFTER_MISSING]
  } else {
    pool = createSuggestedPrompts(userState).map((p) => ({
      text: p.text,
      icon: ICON_BY_PROMPT_TEXT[p.text] ?? MessageCircle,
    }))
  }

  const seen = new Set<string>()
  const filtered = pool.filter((p) => {
    const key = normalizePromptKey(p.text)
    if (key === last || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return filtered.slice(0, 3)
}

type EngineAssistantBody =
  | { kind: "watch"; payload: WatchQuestionAnswer }
  | { kind: "plan"; payload: PlanQuestionAnswer }
  | { kind: "missing"; payload: MissingGamesAnswer }
  | {
      kind: "fallback"
      headline: string
      summary: string
      prompts: readonly string[]
    }

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  engine?: EngineAssistantBody
  assistantIntent?: AssistantIntent
  planScope?: OptimizerScope
  /** Resolved engine game id for watch answers (affiliate / video provider mapping). */
  watchGameId?: string
}

function buildAssistantMessage(query: string, userState: DemoUserState): Message {
  const id = (Date.now() + 1).toString()
  const parsed = parseAssistantQuery(query, userState)
  const promptTexts = DEMO_SUGGESTED_PROMPTS.map((p) => p.text)

  if (parsed.intent === "watch-question") {
    if (!parsed.gameId) {
      return {
        id,
        role: "assistant",
        content: "",
        assistantIntent: "fallback",
        engine: {
          kind: "fallback",
          headline: "Which game?",
          summary:
            "Name the Blues or the Cardinals and I’ll check video against your services.",
          prompts: promptTexts,
        },
      }
    }
    return {
      id,
      role: "assistant",
      content: "",
      assistantIntent: "watch",
      watchGameId: parsed.gameId,
      engine: { kind: "watch", payload: answerWatchQuestion(parsed.gameId, userState) },
    }
  }

  if (parsed.intent === "plan-question") {
    const scope = parsed.scope ?? "both"
    return {
      id,
      role: "assistant",
      content: "",
      assistantIntent: "plan",
      planScope: scope,
      engine: { kind: "plan", payload: answerPlanQuestion(scope, userState) },
    }
  }

  if (parsed.intent === "missing-games") {
    const scope = parsed.scope ?? "both"
    return {
      id,
      role: "assistant",
      content: "",
      assistantIntent: "missing",
      engine: {
        kind: "missing",
        payload: answerMissingGamesQuestion(scope, userState),
      },
    }
  }

  return {
    id,
    role: "assistant",
    content: "",
    assistantIntent: "fallback",
    engine: {
      kind: "fallback",
      headline: "I need a more specific question",
      summary: "Ask about watching a game, plans and upgrades, or what you’re missing on video.",
      prompts: promptTexts,
    },
  }
}

function AssistantContextBar({ userState }: { userState: DemoUserState }) {
  const { isHydrating: isScheduleHydrating, scheduleVersion } = useSchedule()
  const line = useMemo(() => {
    const names = teamsForFollowedIds(userState.followedTeamIds)
      .map((t) => t.name)
      .join(" + ")
    const teamLine = `${names || "Your teams"} · followed teams`
    const ids = userState.connectedServiceIds
    const svc =
      ids.length === 0
        ? "0 services"
        : ids.length <= 2
          ? formatServiceIdList(ids)
          : `${ids.length} services`
    const live = getCurrentUserCoverageSummary("both", userState)
    const gamesLine = `${live.gamesWatchable} of ${live.totalGames} games watchable`
    return `${teamLine} · ${svc} · ${gamesLine} · ${live.coveragePercent}%`
  }, [userState, scheduleVersion])

  if (isScheduleHydrating && userState.connectedServiceIds.length > 0) {
    return (
      <div
        className="mb-4 h-10 animate-pulse rounded-xl border border-border/40 bg-muted/30 px-3 py-2"
        aria-hidden
      />
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-center text-[11px] font-medium leading-snug text-muted-foreground">
      {line}
    </div>
  )
}

function AssistantWhy({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="border-t border-border/40 bg-muted/10 px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Why
      </p>
      <ul className="space-y-2">
        {items.map((r, i) => (
          <li
            key={i}
            className="border-l-2 border-accent/70 pl-3 text-sm leading-snug text-foreground/90"
          >
            {r}
          </li>
        ))}
      </ul>
    </div>
  )
}

function isOutboundUrl(href: string | undefined): boolean {
  return !!href && /^https?:\/\//i.test(href)
}

function handleAssistantCtaClick(
  userState: DemoUserState,
  href: string | undefined,
  label: string,
  affiliate: AffiliateClickMeta | undefined,
  ctaRole: "primary" | "secondary"
) {
  if (!href) return
  const ctaEvent =
    ctaRole === "primary" ? AnalyticsEvent.ctaPrimaryClick : AnalyticsEvent.ctaSecondaryClick
  trackEvent(ctaEvent, {
    ...analyticsBase("assistant", userState, {
      label,
      cta_role: ctaRole,
      ...(affiliate?.serviceId ? { service_id: affiliate.serviceId } : {}),
      ...(affiliate?.planId ? { plan_id: affiliate.planId } : {}),
      ...(affiliate?.intent ? { intent: affiliate.intent } : {}),
    }),
  })
  if (isOutboundUrl(href)) {
    trackAffiliateClick(href, "assistant", userState, {
      label,
      ...(affiliate?.serviceId ? { service_id: affiliate.serviceId } : {}),
      ...(affiliate?.planId ? { plan_id: affiliate.planId } : {}),
      ...(affiliate?.intent ? { intent: affiliate.intent } : { intent: "assistant_outbound" }),
    })
    return
  }
  trackAssistantNavigationClick(userState, href, label)
}

function ActionStack({
  primary,
  secondary,
  valueJustification,
  socialProof,
  userState,
}: {
  primary: { label: string; href?: string; affiliate?: AffiliateClickMeta }
  secondary?: { label: string; href?: string; affiliate?: AffiliateClickMeta }
  valueJustification?: string
  socialProof?: string
  userState: DemoUserState
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border/50 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Next
      </p>
      {primary.href ? (
        isOutboundUrl(primary.href) ? (
          <a
            href={primary.href}
            className="block"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              handleAssistantCtaClick(
                userState,
                primary.href,
                primary.label,
                primary.affiliate,
                "primary"
              )
            }
          >
            <Button className="h-12 w-full gap-2 text-base font-semibold shadow-md">
              {primary.label}
              <ChevronRight className="size-4 opacity-90" />
            </Button>
          </a>
        ) : (
          <Link
            href={primary.href}
            className="block"
            onClick={() =>
              handleAssistantCtaClick(
                userState,
                primary.href,
                primary.label,
                primary.affiliate,
                "primary"
              )
            }
          >
            <Button className="h-12 w-full gap-2 text-base font-semibold shadow-md">
              {primary.label}
              <ChevronRight className="size-4 opacity-90" />
            </Button>
          </Link>
        )
      ) : (
        <Button className="h-12 w-full gap-2 text-base font-semibold shadow-md" type="button">
          {primary.label}
          <ChevronRight className="size-4 opacity-90" />
        </Button>
      )}
      {valueJustification && (
        <p className="text-center text-[11px] leading-snug text-muted-foreground">{valueJustification}</p>
      )}
      {socialProof && (
        <p className="text-center text-[11px] font-medium leading-snug text-foreground/75">{socialProof}</p>
      )}
      {secondary &&
        (secondary.href ? (
          isOutboundUrl(secondary.href) ? (
            <a
              href={secondary.href}
              className="block"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                handleAssistantCtaClick(
                  userState,
                  secondary.href,
                  secondary.label,
                  secondary.affiliate,
                  "secondary"
                )
              }
            >
              <Button variant="ghost" className="h-9 w-full gap-1.5 text-xs font-medium text-muted-foreground">
                {secondary.label}
                <ChevronRight className="size-3.5 opacity-70" />
              </Button>
            </a>
          ) : (
            <Link
              href={secondary.href}
              className="block"
              onClick={() =>
                handleAssistantCtaClick(
                  userState,
                  secondary.href,
                  secondary.label,
                  secondary.affiliate,
                  "secondary"
                )
              }
            >
              <Button variant="ghost" className="h-9 w-full gap-1.5 text-xs font-medium text-muted-foreground">
                {secondary.label}
                <ChevronRight className="size-3.5 opacity-70" />
              </Button>
            </Link>
          )
        ) : (
          <Button
            variant="ghost"
            className="h-9 w-full text-xs font-medium text-muted-foreground"
            type="button"
          >
            {secondary.label}
          </Button>
        ))}
    </div>
  )
}

function SuggestedNextQuestions({
  prompts,
  onPick,
}: {
  prompts: { text: string; icon: LucideIcon }[]
  onPick: (text: string) => void
}) {
  if (prompts.length === 0) return null
  return (
    <div className="w-full rounded-xl border border-border/60 bg-card/40 px-3 py-2.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Suggested next questions
      </p>
      <div className="flex flex-col gap-1.5">
        {prompts.map((p, i) => (
          <button
            key={`${p.text}-${i}`}
            type="button"
            onClick={() => onPick(p.text)}
            className="flex items-center gap-2.5 rounded-lg border border-transparent bg-background/80 px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-secondary/60"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary/80">
              <p.icon className="size-3.5 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1 leading-snug">{p.text}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const { state } = useDemoUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")

  const starterPrompts = useMemo(() => mergedStarterPrompts(state), [state])

  const handleSend = useCallback(
    (text?: string, source: "input" | "suggested" = "input") => {
      const query = text || input
      if (!query.trim()) return

      if (source === "suggested") {
        trackEvent(AnalyticsEvent.assistantSuggestedPromptClick, {
          ...analyticsBase("assistant", state, {
            prompt_key: normalizePromptKey(query).slice(0, 120),
          }),
        })
      } else {
        const parsed = parseAssistantQuery(query, state)
        trackEvent(AnalyticsEvent.assistantPromptSubmit, {
          ...analyticsBase("assistant", state, {
            prompt_length: query.length,
            intent: parsed.intent,
          }),
        })
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: query,
      }

      const assistantMessage = buildAssistantMessage(query, state)

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setInput("")
    },
    [input, state]
  )

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Assistant</h1>
            <p className="text-xs text-muted-foreground">Decide faster, watch smarter</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5">
        {messages.length === 0 ? (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent/15 shadow-inner">
                <Sparkles className="size-7 text-accent" />
              </div>
              <h2 className="mb-1.5 text-lg font-semibold tracking-tight text-foreground">
                Ask anything about watching your teams
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Clear call, short reasons, one next step
              </p>
            </div>

            <AssistantContextBar userState={state} />

            <div className="flex flex-col gap-2.5">
              {starterPrompts.map((prompt, i) => (
                <button
                  key={`${prompt.text}-${i}`}
                  type="button"
                  onClick={() => handleSend(prompt.text, "suggested")}
                  className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-3.5 text-left shadow-sm transition-colors hover:border-accent/25 hover:bg-secondary/40"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary/90">
                    <prompt.icon className="size-4 text-muted-foreground" />
                  </div>
                  <span className="flex-1 text-sm font-medium leading-snug text-foreground">
                    {prompt.text}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-5">
            <AssistantContextBar userState={state} />
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "user" ? (
                  <div className="max-w-[88%] rounded-2xl bg-accent px-4 py-2.5 text-accent-foreground shadow-sm">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                ) : message.engine ? (
                  <div className="w-full space-y-3">
                    <EngineResponseCard
                      body={message.engine}
                      userState={state}
                      planScope={message.planScope}
                      watchGameId={message.watchGameId}
                      assistantMessageId={message.id}
                      onPickPrompt={(t) => handleSend(t, "suggested")}
                    />
                    {message.engine.kind !== "fallback" && (
                      <SuggestedNextQuestions
                        prompts={followUpPrompts(
                          state,
                          index > 0 ? messages[index - 1]?.content : undefined,
                          message.assistantIntent
                        )}
                        onPick={(t) => handleSend(t, "suggested")}
                      />
                    )}
                  </div>
                ) : (
                  <div className="max-w-[88%] rounded-2xl border border-border/60 bg-card px-4 py-2.5 text-card-foreground shadow-sm">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your teams..."
            className="h-11 flex-1 rounded-full border border-border bg-secondary px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <Button
            size="icon"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="size-11 shrink-0 rounded-full shadow-sm"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

function CompactMissingGamesList({ rows }: { rows: MissingGamesAnswer["missingGames"] }) {
  if (rows.length === 0) return null
  const shown = rows.slice(0, 3)
  const rest = rows.length - shown.length
  return (
    <div className="border-t border-border/40 px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Games missing video
      </p>
      <ul className="space-y-1.5">
        {shown.map((g) => (
          <li
            key={g.gameId}
            className="rounded-lg border border-border/40 bg-background/50 px-2.5 py-1.5"
          >
            <span className="text-xs font-medium text-foreground">{g.label}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {g.dateLabel} · {g.status === "listen-only" ? "Listen only" : "No video"}
            </span>
            {g.reason?.trim() ? (
              <span className="mt-1 block line-clamp-2 text-[11px] leading-snug text-muted-foreground/90">
                {g.reason.trim()}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">+{rest} more on the schedule</p>
      )}
    </div>
  )
}

function EngineResponseCard({
  body,
  onPickPrompt,
  userState,
  planScope,
  watchGameId,
  assistantMessageId,
}: {
  body: EngineAssistantBody
  onPickPrompt: (text: string) => void
  userState: DemoUserState
  planScope?: OptimizerScope
  watchGameId?: string
  assistantMessageId: string
}) {
  useEffect(() => {
    trackEvent(AnalyticsEvent.decisionShown, {
      ...analyticsBase("assistant", userState, {
        assistant_card: body.kind,
        message_id: assistantMessageId,
      }),
    })
  }, [assistantMessageId, body.kind, userState])

  if (body.kind === "fallback") {
    const decision = formatAssistantDecision({ kind: "fallback", headline: body.headline })
    const why = formatAssistantWhy({ kind: "fallback", summary: body.summary })
    return (
      <Card className="w-full overflow-hidden rounded-xl border-border/80 bg-card shadow-md">
        <div className="bg-gradient-to-br from-secondary/40 to-secondary/15 px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Decision
          </p>
          <p className="mt-1 text-base font-bold leading-snug tracking-tight text-foreground">
            {decision}
          </p>
        </div>
        <AssistantWhy items={why} />
        <div className="p-4 pt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Try asking
          </p>
          <div className="flex flex-col gap-1.5">
            {DEMO_SUGGESTED_PROMPTS.filter((p) => body.prompts.includes(p.text)).map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickPrompt(p.text)}
                className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/90 px-2.5 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-accent/30 hover:bg-secondary/50"
              >
                <p.icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 leading-snug">{p.text}</span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (body.kind === "watch") {
    const p = body.payload
    const decision = formatAssistantDecision({
      kind: "watch",
      payload: p,
      gameId: watchGameId,
      userState,
    })
    const why = formatAssistantWhy({ kind: "watch", payload: p })
    const next = formatAssistantNextAction({
      kind: "watch",
      payload: p,
      gameId: watchGameId,
      userState,
    })
    return (
      <Card className="w-full overflow-hidden rounded-xl border-border/80 bg-card shadow-md">
        <div className="bg-gradient-to-br from-secondary/40 to-secondary/15 px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Decision
          </p>
          <p className="mt-1 text-base font-bold leading-snug tracking-tight text-foreground">
            {decision}
          </p>
        </div>
        <AssistantWhy items={why} />
        <ActionStack
          primary={next.primary}
          secondary={next.secondary}
          valueJustification={next.valueJustification}
          socialProof={next.socialProof}
          userState={userState}
        />
      </Card>
    )
  }

  if (body.kind === "plan") {
    const p = body.payload
    const scope = planScope ?? "both"
    const decision = formatAssistantDecision({
      kind: "plan",
      payload: p,
      scope,
      userState,
    })
    const why = formatAssistantWhy({
      kind: "plan",
      payload: p,
      scope,
      userState,
      decisionText: decision,
    })
    const next = formatAssistantNextAction({
      kind: "plan",
      payload: p,
      scope,
      userState,
    })
    return (
      <Card className="w-full overflow-hidden rounded-xl border-border/80 bg-card shadow-md">
        <div className="bg-gradient-to-br from-secondary/40 to-secondary/15 px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Decision
          </p>
          <p className="mt-1 text-base font-bold leading-snug tracking-tight text-foreground">
            {decision}
          </p>
        </div>
        <AssistantWhy items={why} />
        <ActionStack
          primary={next.primary}
          secondary={next.secondary}
          valueJustification={next.valueJustification}
          socialProof={next.socialProof}
          userState={userState}
        />
      </Card>
    )
  }

  const p = body.payload
  const decision = formatAssistantDecision({ kind: "missing", payload: p })
  const why = formatAssistantWhy({
    kind: "missing",
    payload: p,
    userState,
    decisionText: decision,
  })
  const next = formatAssistantNextAction({
    kind: "missing",
    payload: p,
    userState,
  })

  return (
    <Card className="w-full overflow-hidden rounded-xl border-border/80 bg-card shadow-md">
      <div className="bg-gradient-to-br from-secondary/40 to-secondary/15 px-4 py-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Decision
        </p>
        <p className="mt-1 text-base font-bold leading-snug tracking-tight text-foreground">
          {decision}
        </p>
      </div>
      <AssistantWhy items={why} />
      <CompactMissingGamesList rows={p.missingGames} />
      <ActionStack
        primary={next.primary}
        secondary={next.secondary}
        valueJustification={next.valueJustification}
        socialProof={next.socialProof}
        userState={userState}
      />
    </Card>
  )
}
