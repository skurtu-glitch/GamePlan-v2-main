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
import type { BroadcastProfileId } from "@/lib/data-sources/schedule/types"
import type { NormalizedPipelineGame } from "@/lib/data-normalization/normalize-schedule"

function recommendationFor(watchStatus: Game["watch"]["status"]): Game["recommendation"] {
  if (watchStatus === "available") return "Watch"
  if (watchStatus === "partial") return "Just Listen"
  return "Just Listen"
}

/**
 * Curated `access` blocks for profiles where demo UX expects explicit actions (national ESPN+, RSN gaps).
 * Exported for static demo fallback parity with ingest.
 */
export function optionalAccessForProfile(
  profile: BroadcastProfileId,
  listenLabel: string
): Game["access"] | undefined {
  if (profile === "nhl-national-espn-plus" || profile === "mlb-national-espn-plus") {
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
          label: `Listen on ${listenLabel}`,
          type: "open",
          provider: listenLabel,
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

  if (profile === "mlb-rsn-fanduel-unavailable") {
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
          label: `Listen free on ${listenLabel}`,
          type: "open",
          provider: listenLabel,
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

    const access = optionalAccessForProfile(row.broadcastProfile, listenLabel)
    if (access) game.access = access

    return game
  })
}
