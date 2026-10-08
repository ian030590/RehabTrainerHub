export interface GameChannelState { gameId: string; version: string; sessionNonce: string; sequence: number; complete: boolean }
export function AcceptGameMessage(message: unknown, state: GameChannelState): boolean;
export function IsGameResult(payload: unknown, gameId: string): boolean;
