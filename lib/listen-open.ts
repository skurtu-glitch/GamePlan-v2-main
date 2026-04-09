/**
 * Demo “open listen” routing: in-app stub when no per-feed URL (same idea as {@link watchStubPath}).
 */

/** In-app stub: `/listen/stub?gameId=…` */
export function listenStubPath(gameId: string): string {
  return `/listen/stub?gameId=${encodeURIComponent(gameId)}`
}

export function listenOpenButtonLabel(): string {
  return "How to listen"
}
