import type { Game, ListenFeed } from "@/lib/types"

/**
 * Keeps curated `listenFeeds` aligned with `game.listen.provider`, which is what
 * `resolveGameAccess` uses for the primary listen action.
 *
 * Only the first `home` row is updated — treated as the flagship feed (e.g. English primary);
 * additional `home` rows (e.g. Spanish) are left as-authored.
 */
export function alignListenFeedsWithGameListen(game: Game, feeds: ListenFeed[]): ListenFeed[] {
  const flagship = game.listen.provider?.trim()
  if (!flagship) return feeds

  let appliedPrimaryHome = false
  return feeds.map((feed) => {
    if (feed.type !== "home" || appliedPrimaryHome) return feed
    appliedPrimaryHome = true
    if (feed.provider === flagship) return feed
    return { ...feed, provider: flagship }
  })
}
