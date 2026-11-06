export function CreateIdentityGuard(
  readToken: () => string | null,
  signal?: AbortSignal,
): () => boolean {
  const token = readToken();
  return () => Boolean(token) && token === readToken() && !signal?.aborted;
}

export function NextIdentityEpoch(
  epoch: number,
  previousUserId: string | null,
  nextUserId: string | null,
): number {
  return previousUserId !== null && previousUserId !== nextUserId ? epoch + 1 : epoch;
}
