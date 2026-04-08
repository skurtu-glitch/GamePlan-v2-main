# GamePlan project rules

This project is an AI-powered sports access assistant.

Core product principles:
- Never show dead ends.
- Always distinguish between Watchable, Listen Only, and Not available with current plan.
- Never present blackout as the final answer; always frame it in terms of current subscriptions and next best action.
- Audio is a fallback, not the primary recommendation.
- Plan order must always be:
  1. Cheapest
  2. Best Value
  3. Full Coverage
  4. Radio Only
- Cheapest must include at least some watchable games.
- Best Value should be highlighted.
- Use dark theme, premium UI, concise language.
- Keep logic deterministic where possible.
- AI explains; deterministic functions decide coverage and plan logic.