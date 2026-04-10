/**
 * Compose resolver-facing `Game` rows from normalized pipeline games + team catalog.
 * Preserves watch/listen/listener copy patterns expected by `resolveGameAccess` (unchanged contract).
 */

import type { Game, Team } from "@/lib/types"
import { LISTEN_FEED, PROVIDER_LABEL } from "@/lib/streaming-service-ids"
import {
  listenLabelForGame,
  watchMappingForProfile,
} from "@/lib/data-sources/rights/provider-map"
import type { NormalizedPipelineGame } from "@/lib/data-normalization/normalize-schedule"

function recommendationFor(watchStatus: Game["watch"]["status"]): Game["recommendation"] {
  if (watchStatus === "available") return "Watch"
  if (watchStatus === "partial") return "Just Listen"
  return "Just Listen"
}

function optionalAccessBlock(row: NormalizedPipelineGame): Game["access"] | undefined {
  if (row.broadcastProfile === "nhl-national-espn-plus") {
    return {
      status: "watchable",
      reason: `Available on ${PROVIDER_LABEL.ESPN_PLUS} with your subscription`,
      actions: [
        {
          label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`,
          type: "open",
          provider: PROVIDER_LABEL.ESPN_PLUS,
        },
        {
          label: `Listen on ${LISTEN_FEED.BLUES_AM}`,
          type: "open",
          provider: LISTEN_FEED.BLUES_AM,
        },
      ],
      bestOption: {
        label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`,
        action: {
          label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`,
          type: "open",
          provider: PROVIDER_LABEL.ESPN_PLUS,
        },
      },
    }
  }

  if (row.broadcastProfile === "mlb-rsn-fanduel-unavailable") {
    return {
      status: "unavailable",
      reason: `Your plan doesn't include ${PROVIDER_LABEL.FANDUEL_RSN}`,
      actions: [
        {
          label: `Add ${PROVIDER_LABEL.FANDUEL_RSN}`,
          type: "add",
          provider: PROVIDER_LABEL.FANDUEL_RSN,
          price: "$19.99/mo",
        },
        {
          label: `Listen free on ${LISTEN_FEED.CARDINALS_AM}`,
          type: "open",
          provider: LISTEN_FEED.CARDINALS_AM,
        },
      ],
      bestOption: {
        label: "Add RSN to watch",
        action: {
          label: `Add ${PROVIDER_LABEL.FANDUEL_RSN}`,
          type: "add",
          provider: PROVIDER_LABEL.FANDUEL_RSN,
          price: "$19.99/mo",
        },
      },
    }
  }

  return undefined
}

export function composeEngineGamesFromNormalized(
  rows: NormalizedPipelineGame[],
  teamById: ReadonlyMap<string, Team>
): Game[] {
  return rows.map((row) => {
    const home = teamById.get(row.homeTeamId)
    const away = teamById.get(row.awayTeamId)
    if (!home || !away) {
      throw new Error(`composeEngineGames: missing team for row ${row.id}`)
    }

    const wm = watchMappingForProfile(row.broadcastProfile)
    const listenLabel = listenLabelForGame(row.homeTeamId, row.awayTeamId)

    const watch: Game["watch"] = {
      status: wm.status,
      provider: wm.provider,
      providers: [...wm.providers],
      ...(wm.note ? { note: wm.note } : {}),
    }

    const listen: Game["listen"] = {
      status: "available",
      provider: listenLabel,
    }

    const game: Game = {
      id: row.id,
      homeTeam: home,
      awayTeam: away,
      dateTime: row.dateTime,
      watch,
      listen,
      recommendation: recommendationFor(watch.status),
      ...(row.venue ? { venue: row.venue } : {}),
    }

    const access = optionalAccessBlock(row)
    if (access) game.access = access

    return game
  })
}
