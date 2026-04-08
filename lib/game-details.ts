import type { GameDetail } from "./types"
import { games } from "./data"
import { alignListenFeedsWithGameListen } from "./align-listen-feeds"
import { LISTEN_FEED } from "./streaming-service-ids"

export const bluesGameDetail: GameDetail = {
  ...games[0],
  listenFeeds: [
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
}

export const cardinalsGameDetail: GameDetail = {
  ...games[1],
  listenFeeds: [
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

export const gameDetails: Record<string, GameDetail> = {
  "game-1": bluesGameDetail,
  "game-2": cardinalsGameDetail,
}

export function getGameDetail(id: string): GameDetail | undefined {
  const row = gameDetails[id]
  if (!row) return undefined
  return {
    ...row,
    listenFeeds: alignListenFeedsWithGameListen(row, row.listenFeeds),
  }
}
