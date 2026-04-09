import { WatchStubClient } from "./watch-stub-client"

function gameIdFromSearch(
  sp: Record<string, string | string[] | undefined>
): string {
  const raw = sp.gameId
  if (raw === undefined) return ""
  return Array.isArray(raw) ? (raw[0] ?? "") : raw
}

export default async function WatchStubPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { serviceId: rawSegment } = await params
  const sp = await searchParams
  const gameId = gameIdFromSearch(sp)
  return (
    <WatchStubClient rawServiceIdSegment={rawSegment} gameId={gameId} />
  )
}
