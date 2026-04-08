import type { Team, Game, StreamingPlan } from "./types"
import { LISTEN_FEED, PROVIDER_LABEL, serviceDisplayName } from "./streaming-service-ids"

export const teams: Team[] = [
  {
    id: "stl-blues",
    name: "Blues",
    city: "St. Louis",
    abbreviation: "STL",
    sport: "NHL",
    primaryColor: "#002F87",
    logo: "/teams/blues.svg",
  },
  {
    id: "stl-cardinals",
    name: "Cardinals",
    city: "St. Louis",
    abbreviation: "STL",
    sport: "MLB",
    primaryColor: "#C41E3A",
    logo: "/teams/cardinals.svg",
  },
  {
    id: "col-avalanche",
    name: "Avalanche",
    city: "Colorado",
    abbreviation: "COL",
    sport: "NHL",
    primaryColor: "#6F263D",
    logo: "/teams/avalanche.svg",
  },
  {
    id: "chi-cubs",
    name: "Cubs",
    city: "Chicago",
    abbreviation: "CHC",
    sport: "MLB",
    primaryColor: "#0E3386",
    logo: "/teams/cubs.svg",
  },
]

export const userTeams = teams.filter((t) =>
  ["stl-blues", "stl-cardinals"].includes(t.id)
)

// Helper to create dates relative to now
const today = new Date()
const todayAt = (hour: number, min = 0) => {
  const d = new Date(today)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
const tomorrowAt = (hour: number, min = 0) => {
  const d = new Date(today)
  d.setDate(d.getDate() + 1)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
const daysFromNow = (days: number, hour: number, min = 0) => {
  const d = new Date(today)
  d.setDate(d.getDate() + days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

export const games: Game[] = [
  // Tonight's games
  {
    id: "game-1",
    homeTeam: teams.find((t) => t.id === "stl-blues")!,
    awayTeam: teams.find((t) => t.id === "col-avalanche")!,
    dateTime: todayAt(19, 0),
    watch: {
      status: "available",
      provider: PROVIDER_LABEL.ESPN_PLUS,
      providers: ["espn-plus"],
    },
    listen: {
      status: "available",
      provider: LISTEN_FEED.BLUES_AM,
    },
    recommendation: "Watch",
    venue: "Enterprise Center",
    access: {
      status: "watchable",
      reason: `Available on ${PROVIDER_LABEL.ESPN_PLUS} with your subscription`,
      actions: [
        { label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`, type: "open", provider: PROVIDER_LABEL.ESPN_PLUS },
        { label: `Listen on ${LISTEN_FEED.BLUES_AM}`, type: "open", provider: LISTEN_FEED.BLUES_AM },
      ],
      bestOption: {
        label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`,
        action: { label: `Watch on ${PROVIDER_LABEL.ESPN_PLUS}`, type: "open", provider: PROVIDER_LABEL.ESPN_PLUS },
      },
    },
  },
  {
    id: "game-2",
    homeTeam: teams.find((t) => t.id === "stl-cardinals")!,
    awayTeam: teams.find((t) => t.id === "chi-cubs")!,
    dateTime: todayAt(19, 15),
    watch: {
      status: "unavailable",
      provider: PROVIDER_LABEL.FANDUEL_RSN,
      providers: ["fanduel-sports"],
      note: "Not available with your current plan",
    },
    listen: {
      status: "available",
      provider: LISTEN_FEED.CARDINALS_AM,
    },
    recommendation: "Just Listen",
    venue: "Busch Stadium",
    access: {
      status: "unavailable",
      reason: `Your plan doesn't include ${PROVIDER_LABEL.FANDUEL_RSN}`,
      actions: [
        { label: `Add ${PROVIDER_LABEL.FANDUEL_RSN}`, type: "add", provider: PROVIDER_LABEL.FANDUEL_RSN, price: "$19.99/mo" },
        { label: `Listen free on ${LISTEN_FEED.CARDINALS_AM}`, type: "open", provider: LISTEN_FEED.CARDINALS_AM },
      ],
      bestOption: {
        label: "Add RSN to watch",
        action: { label: `Add ${PROVIDER_LABEL.FANDUEL_RSN}`, type: "add", provider: PROVIDER_LABEL.FANDUEL_RSN, price: "$19.99/mo" },
      },
    },
  },
  // Upcoming games
  {
    id: "game-3",
    homeTeam: teams.find((t) => t.id === "col-avalanche")!,
    awayTeam: teams.find((t) => t.id === "stl-blues")!,
    dateTime: tomorrowAt(20, 0),
    watch: {
      status: "available",
      provider: PROVIDER_LABEL.MAX,
      providers: ["max"],
    },
    listen: {
      status: "available",
      provider: LISTEN_FEED.BLUES_AM,
    },
    recommendation: "Watch",
    venue: "Ball Arena",
  },
  {
    id: "game-4",
    homeTeam: teams.find((t) => t.id === "chi-cubs")!,
    awayTeam: teams.find((t) => t.id === "stl-cardinals")!,
    dateTime: daysFromNow(3, 13, 20),
    watch: {
      status: "partial",
      provider: PROVIDER_LABEL.MLB_TV,
      providers: ["mlb-tv"],
      note: "Out-of-market only",
    },
    listen: {
      status: "available",
      provider: LISTEN_FEED.CARDINALS_AM,
    },
    recommendation: "Just Listen",
    venue: "Wrigley Field",
  },
  {
    id: "game-5",
    homeTeam: teams.find((t) => t.id === "stl-blues")!,
    awayTeam: teams.find((t) => t.id === "col-avalanche")!,
    dateTime: daysFromNow(5, 19, 0),
    watch: {
      status: "available",
      provider: PROVIDER_LABEL.FANDUEL_RSN,
      providers: ["fanduel-sports"],
    },
    listen: {
      status: "available",
      provider: LISTEN_FEED.BLUES_AM,
    },
    recommendation: "Watch",
    venue: "Enterprise Center",
  },
]

export const streamingPlans: StreamingPlan[] = [
  {
    id: "espn-plus",
    name: serviceDisplayName("espn-plus"),
    price: 10.99,
    priceUnit: "month",
    channels: [serviceDisplayName("espn-plus"), "ABC (select games)"],
    sports: ["NHL", "MLB", "NFL", "NBA"],
    pros: ["Out-of-market NHL games", "Affordable price"],
    cons: ["In-market restrictions apply", "No regional sports networks"],
  },
  {
    id: "fubo",
    name: "Fubo",
    price: 79.99,
    priceUnit: "month",
    channels: [PROVIDER_LABEL.FANDUEL_RSN, "ESPN", "FS1", "NBC Sports"],
    sports: ["NHL", "MLB", "NFL", "NBA"],
    pros: ["Regional sports networks", "DVR included"],
    cons: ["Higher price", "Some markets excluded"],
  },
  {
    id: "mlb-tv",
    name: serviceDisplayName("mlb-tv"),
    price: 149.99,
    priceUnit: "year",
    channels: ["All out-of-market MLB games"],
    sports: ["MLB"],
    pros: ["Every out-of-market game", "Multi-device streaming"],
    cons: ["In-market viewing rules apply", "MLB only"],
  },
]
