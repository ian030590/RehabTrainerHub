let paused = false;

export function SetReadingPaused(value: boolean) { paused = value; }
export function IsReadingPaused() { return paused; }
