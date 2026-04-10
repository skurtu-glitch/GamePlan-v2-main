import { teamsForFollowedIds } from "@/lib/data"

/** Short subtitle for schedule surfaces from followed catalog teams (no STL-only copy). */
export function followedTeamsScheduleSubtitle(ids: readonly string[]): string {
  const rows = teamsForFollowedIds(ids)
  if (rows.length === 0) return "Your teams"
  const labels = rows.map((t) => `${t.city} ${t.name}`)
  if (labels.length <= 3) return labels.join(" · ")
  return `${labels.slice(0, 2).join(" · ")} · +${labels.length - 2} more`
}

/** Nicknames joined, e.g. `Blues + Cardinals` (matches default two-team demo). */
export function followedTeamNamesPlus(ids: readonly string[]): string {
  const rows = teamsForFollowedIds(ids)
  if (rows.length === 0) return "your teams"
  return rows.map((t) => t.name).join(" + ")
}

/** Scope phrase for headers: single team, multi-team, or count. */
export function followedTeamsScopePhrase(ids: readonly string[]): string {
  const n = teamsForFollowedIds(ids).length
  if (n <= 1) return "your team"
  if (n === 2) return "your followed teams"
  return `${n} teams`
}

/** One line under the app title, e.g. `Blues + Cardinals — your followed teams` */
export function followedTeamsHeaderLine(ids: readonly string[]): string {
  const names = followedTeamNamesPlus(ids)
  const scope = followedTeamsScopePhrase(ids)
  return `${names} — ${scope}`
}
