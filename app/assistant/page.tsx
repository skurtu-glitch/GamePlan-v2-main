"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { BottomNav } from "@/components/bottom-nav"
import { useDemoUser } from "@/components/providers/demo-user-provider"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Send,
  Sparkles,
  Tv,
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
import type { DemoUserState } from "@/lib/demo-user"
import {
  AnalyticsEvent,
  analyticsBase,
  trackAssistantNavigationClick,
  trackEvent,
} from "@/lib/analytics"

const DEMO_SUGGESTED_PROMPTS = [
  { icon: Tv, text: "Can I watch tonight’s Blues game?" },
  { icon: Tv, text: "Why can’t I watch the Cardinals tonight?" },
  { icon: TrendingUp, text: "What’s the cheapest way to follow both teams?" },
  { icon: Calendar, text: "What games am I missing this week?" },
] as const

const ICON_BY_PROMPT_TEXT: Record<string, LucideIcon> = Object.fromEntries(
  DEMO_SUGGESTED_PROMPTS.map((p) => [p.text, p.icon])
)

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

function followUpPrompts(
  userState: DemoUserState,
  lastUserMessage: string | undefined
): { text: string; icon: LucideIcon }[] {
  const last = lastUserMessage ? normalizePromptKey(lastUserMessage) : ""
  const pool = createSuggestedPrompts(userState).map((p) => ({
    text: p.text,
    icon: ICON_BY_PROMPT_TEXT[p.text] ?? MessageCircle,
  }))
  const filtered = pool.filter((p) => normalizePromptKey(p.text) !== last)
  return filtered.slice(0, 4)
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
        engine: {
          kind: "fallback",
          headline: "Which game?",
          summary:
            "Say if you mean the Blues or the Cardinals tonight — I’ll check your services against the demo schedule.",
          prompts: promptTexts,
        },
      }
    }
    return {
      id,
      role: "assistant",
      content: "",
      engine: { kind: "watch", payload: answerWatchQuestion(parsed.gameId, userState) },
    }
  }

  if (parsed.intent === "plan-question") {
    const scope = parsed.scope ?? "both"
    return {
      id,
      role: "assistant",
      content: "",
      engine: { kind: "plan", payload: answerPlanQuestion(scope, userState) },
    }
  }

  if (parsed.intent === "missing-games") {
    const scope = parsed.scope ?? "both"
    return {
      id,
      role: "assistant",
      content: "",
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
    engine: {
      kind: "fallback",
      headline: "Not sure how to help with that yet",
      summary:
        "Ask about watching a specific team’s game, compare plans, or see what you’re missing this week. Pick a prompt below to try the demo.",
      prompts: promptTexts,
    },
  }
}

function ResponseReasons({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-3 border-t border-border/50 bg-muted/15 px-5 py-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Details
      </p>
      <ul className="space-y-3">
        {items.map((r, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
            <span
              className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"
              aria-hidden
            />
            <span className="min-w-0 text-foreground/90">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActionStack({
  primary,
  secondary,
  userState,
}: {
  primary: { label: string; href?: string }
  secondary?: { label: string; href?: string }
  userState: DemoUserState
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border/50 p-5">
      {primary.href ? (
        <Link
          href={primary.href}
          className="block"
          onClick={() =>
            trackAssistantNavigationClick(userState, primary.href, primary.label)
          }
        >
          <Button className="h-11 w-full gap-2 text-base font-semibold shadow-sm">
            {primary.label}
            <ChevronRight className="size-4 opacity-90" />
          </Button>
        </Link>
      ) : (
        <Button className="h-11 w-full gap-2 text-base font-semibold shadow-sm" type="button">
          {primary.label}
          <ChevronRight className="size-4 opacity-90" />
        </Button>
      )}
      {secondary &&
        (secondary.href ? (
          <Link
            href={secondary.href}
            className="block"
            onClick={() =>
              trackAssistantNavigationClick(userState, secondary.href, secondary.label)
            }
          >
            <Button variant="outline" className="h-11 w-full gap-2 text-sm font-medium">
              {secondary.label}
              <ChevronRight className="size-4 opacity-70" />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="h-11 w-full text-sm font-medium" type="button">
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
    <div className="w-full rounded-2xl border border-border/60 bg-card/40 px-4 py-3.5">
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Suggested next questions
      </p>
      <div className="flex flex-col gap-2">
        {prompts.map((p, i) => (
          <button
            key={`${p.text}-${i}`}
            type="button"
            onClick={() => onPick(p.text)}
            className="flex items-center gap-3 rounded-xl border border-transparent bg-background/80 px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-secondary/60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80">
              <p.icon className="size-4 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1 leading-snug">{p.text}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
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
            <p className="text-xs text-muted-foreground">Your smart sports concierge</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {messages.length === 0 ? (
          <>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-accent/15 shadow-inner">
                <Sparkles className="size-8 text-accent" />
              </div>
              <h2 className="mb-2 text-lg font-semibold tracking-tight text-foreground">
                Ask anything about watching your teams
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                I&apos;ll give you specific, actionable answers
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {starterPrompts.map((prompt, i) => (
                <button
                  key={`${prompt.text}-${i}`}
                  type="button"
                  onClick={() => handleSend(prompt.text, "suggested")}
                  className="flex items-center gap-4 rounded-2xl border border-border/80 bg-card p-4 text-left shadow-sm transition-colors hover:border-accent/25 hover:bg-secondary/40"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-secondary/90">
                    <prompt.icon className="size-5 text-muted-foreground" />
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
          <div className="flex flex-col gap-6">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "user" ? (
                  <div className="max-w-[88%] rounded-2xl bg-accent px-4 py-3 text-accent-foreground shadow-sm">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                ) : message.engine ? (
                  <div className="w-full space-y-4">
                    <EngineResponseCard
                      body={message.engine}
                      userState={state}
                      onPickPrompt={(t) => handleSend(t, "suggested")}
                    />
                    {message.engine.kind !== "fallback" && (
                      <SuggestedNextQuestions
                        prompts={followUpPrompts(
                          state,
                          index > 0 ? messages[index - 1]?.content : undefined
                        )}
                        onPick={(t) => handleSend(t, "suggested")}
                      />
                    )}
                  </div>
                ) : (
                  <div className="max-w-[88%] rounded-2xl border border-border/60 bg-card px-4 py-3 text-card-foreground shadow-sm">
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

function EngineResponseCard({
  body,
  onPickPrompt,
  userState,
}: {
  body: EngineAssistantBody
  onPickPrompt: (text: string) => void
  userState: DemoUserState
}) {
  if (body.kind === "fallback") {
    return (
      <Card className="w-full overflow-hidden rounded-2xl border-border/80 bg-card shadow-md">
        <div className="border-b border-border/50 bg-gradient-to-br from-secondary/50 to-secondary/20 px-5 py-5">
          <p className="text-base font-semibold leading-snug tracking-tight text-foreground">
            {body.headline}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body.summary}</p>
        </div>
        <div className="p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Try asking
          </p>
          <div className="flex flex-col gap-2">
            {DEMO_SUGGESTED_PROMPTS.filter((p) => body.prompts.includes(p.text)).map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPickPrompt(p.text)}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/90 px-3 py-3 text-left text-sm font-medium text-foreground transition-colors hover:border-accent/30 hover:bg-secondary/50"
              >
                <p.icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 leading-snug">{p.text}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (body.kind === "watch") {
    const p = body.payload
    return (
      <Card className="w-full overflow-hidden rounded-2xl border-border/80 bg-card shadow-md">
        <div className="border-b border-border/50 bg-gradient-to-br from-secondary/50 to-secondary/20 px-5 py-5">
          <p className="text-base font-semibold leading-snug tracking-tight text-foreground">
            {p.headline}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
        </div>
        <ResponseReasons items={p.reasons} />
        <ActionStack
          primary={p.primaryAction}
          secondary={p.secondaryAction}
          userState={userState}
        />
      </Card>
    )
  }

  if (body.kind === "plan") {
    const p = body.payload
    return (
      <Card className="w-full overflow-hidden rounded-2xl border-border/80 bg-card shadow-md">
        <div className="border-b border-border/50 bg-gradient-to-br from-secondary/50 to-secondary/20 px-5 py-5">
          <p className="text-base font-semibold leading-snug tracking-tight text-foreground">
            {p.headline}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
        </div>
        <ResponseReasons items={p.reasons} />
        <ActionStack
          primary={{ label: "Compare plans", href: "/plans" }}
          userState={userState}
        />
      </Card>
    )
  }

  const p = body.payload
  return (
    <Card className="w-full overflow-hidden rounded-2xl border-border/80 bg-card shadow-md">
      <div className="border-b border-border/50 bg-gradient-to-br from-secondary/50 to-secondary/20 px-5 py-5">
        <p className="text-base font-semibold leading-snug tracking-tight text-foreground">
          {p.headline}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>
      </div>
      {p.missingGames.length > 0 && (
        <div className="border-t border-border/50 bg-muted/10 px-5 py-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Not fully watchable
          </p>
          <ul className="space-y-3">
            {p.missingGames.map((g) => (
              <li
                key={g.gameId}
                className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5"
              >
                <span className="text-sm font-medium text-foreground">{g.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {g.dateLabel} · {g.status === "listen-only" ? "Listen only" : "Not available"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ResponseReasons items={p.reasons} />
      <ActionStack
        primary={p.primaryAction}
        secondary={p.secondaryAction}
        userState={userState}
      />
    </Card>
  )
}
