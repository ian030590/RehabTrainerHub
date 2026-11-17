export type DecoderDock = 'left' | 'right' | 'top' | 'bottom';

export function ResolveDecoderDock(portrait: boolean, choice: DecoderDock | null): DecoderDock {
  return choice ?? (portrait ? 'bottom' : 'right');
}
