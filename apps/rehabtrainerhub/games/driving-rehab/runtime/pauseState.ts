let paused = false;

export function SetDrivingPaused(value: boolean) { paused = value; }
export function IsDrivingPaused() { return paused; }
