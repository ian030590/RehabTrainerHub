let paused = false;

export function SetMovingCardPaused(value: boolean) { paused = value; }
export function IsMovingCardPaused() { return paused; }
