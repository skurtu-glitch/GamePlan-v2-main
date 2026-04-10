/**
 * TTL cache for remote schedule JSON (`GAMEPLAN_SCHEDULE_SOURCE_URL`).
 * Used by `fetch-schedule` and the refresh API — not by synchronous `getEngineGames()`.
 */

let remoteCache: { url: string; raw: unknown; fetchedAt: number } | null = null

export function getScheduleCacheTtlMs(): number {
  const n = Number(process.env.GAMEPLAN_SCHEDULE_CACHE_TTL_MS ?? 15 * 60 * 1000)
  return Number.isFinite(n) && n > 0 ? n : 15 * 60 * 1000
}

/**
 * Force-clear remote JSON cache (e.g. after admin refresh).
 */
export function invalidateRemoteScheduleCache(): void {
  remoteCache = null
}

export async function getOrFetchRemoteScheduleJson(
  url: string,
  force: boolean
): Promise<unknown> {
  const ttl = getScheduleCacheTtlMs()
  const now = Date.now()
  if (!force && remoteCache && remoteCache.url === url && now - remoteCache.fetchedAt < ttl) {
    return remoteCache.raw
  }
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Schedule HTTP ${res.status} for ${url}`)
  }
  const raw: unknown = await res.json()
  remoteCache = { url, raw, fetchedAt: now }
  return raw
}
