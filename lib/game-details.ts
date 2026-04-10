import type { Game, GameDetail, ListenFeed } from "./types"
import { getEngineGames } from "./data"
import { alignListenFeedsWithGameListen } from "./align-listen-feeds"
import { LISTEN_FEED } from "./streaming-service-ids"

/**
 * Curated listen rows keyed by stable engine `game.id` (not schedule array order).
 * Games without an entry use {@link defaultListenFeedsForGame}.
 */
const CURATED_LISTEN_FEEDS: Record<string, ListenFeed[]> = {
  "game-1": [
    {
      name: "Blues Radio Network",
      type: "home",
      provider: LISTEN_FEED.BLUES_AM,
      free: true,
      url: "https://101espn.com/listen",
    },
    {
      name: "Altitude Sports Radio",
      type: "away",
      provider: "92.5 FM Denver",
      free: true,
      url: "https://altitudesportsradio.com",
    },
    {
      name: "NHL App Audio",
      type: "national",
      provider: "NHL App",
      free: false,
    },
  ],
  "game-2": [
    {
      name: "Cardinals Radio Network",
      type: "home",
      provider: LISTEN_FEED.CARDINALS_AM,
      free: true,
      url: "https://kmox.com/listen",
    },
    {
      name: "Cardinals Spanish Radio",
      type: "home",
      provider: "WIJR 880 AM",
      free: true,
    },
    {
      name: "Cubs Radio Network",
      type: "away",
      provider: "670 The Score",
      free: true,
      url: "https://670thescore.com",
    },
    {
      name: "MLB Audio",
      type: "national",
      provider: "MLB App",
      free: false,
    },
  ],
}

function defaultListenFeedsForGame(game: Game): ListenFeed[] {
  const homeProvider = game.listen.provider?.trim() || "Team audio"
  const national: ListenFeed =
    game.homeTeam.league === "MLB"
      ? { name: "MLB Audio", type: "national", provider: "MLB App", free: false }
      : { name: "NHL App Audio", type: "national", provider: "NHL App", free: false }

  return [
    {
      name: `${game.homeTeam.city} ${game.homeTeam.name} Radio`,
      type: "home",
      provider: homeProvider,
      free: true,
    },
    {
      name: `${game.awayTeam.city} ${game.awayTeam.name} Radio`,
      type: "away",
      provider: `${game.awayTeam.city} broadcast`,
      free: true,
    },
    national,
  ]
}

export function getGameDetail(id: string): GameDetail | undefined {
  const game = getEngineGames().find((g) => g.id === id)
  if (!game) return undefined

  const listenFeeds = CURATED_LISTEN_FEEDS[id] ?? defaultListenFeedsForGame(game)
  const detail: GameDetail = { ...game, listenFeeds }

  return {
    ...detail,
    listenFeeds: alignListenFeedsWithGameListen(detail, detail.listenFeeds),
  }
}
