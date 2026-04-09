import { ListenStubClient } from "./listen-stub-client"

function gameIdFromSearch(
  sp: Record<string, string | string[] | undefined>
): string {
  const raw = sp.gameId
  if (raw === undefined) return ""
  return Array.isArray(raw) ? (raw[0] ?? "") : raw
}

export default async function ListenStubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const gameId = gameIdFromSearch(sp)
  return <ListenStubClient gameId={gameId} />
}
