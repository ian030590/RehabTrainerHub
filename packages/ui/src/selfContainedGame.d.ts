export interface GameChannelState { gameId: string; version: string; sessionNonce: string; sequence: number; complete: boolean; capabilities?: string[] }
export function AcceptGameMessage(message: unknown, state: GameChannelState): boolean;
export function IsGameResult(payload: unknown, gameId: string): boolean;
export function AcceptGameSettingsMessage(message: unknown, state: GameChannelState): boolean;
export function IsGameSettings(value: unknown): value is Record<string, string | number | boolean>;
export function ReadSavedGameSettings(storage: Pick<Storage, 'getItem'> | null | undefined, gameId: string): Record<string, string | number | boolean> | null;
export function WriteSavedGameSettings(storage: Pick<Storage, 'setItem'> | null | undefined, gameId: string, settings: unknown): void;
export function SensorAllowed(state: Pick<GameChannelState, 'gameId' | 'capabilities'>, input: string): boolean;
export function CameraSensorAllowed(state: Pick<GameChannelState, 'gameId' | 'capabilities'>): boolean;
export function IsPreviewRect(value: unknown): value is { visible: boolean; x: number; y: number; width: number; height: number };
