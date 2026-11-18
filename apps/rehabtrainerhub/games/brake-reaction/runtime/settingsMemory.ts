// The container keeps the last confirmed settings on this device and returns them at start.
// Only keys this game defines are restored; any invalid value means the defaults are used.
export function RestoreSettings<T extends object>(saved: Record<string, unknown>, defaults: T, validate: (settings: T) => boolean): T | null {
  const restored = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(defaults)) {
    if (Object.hasOwn(saved, key) && typeof saved[key] === typeof value) restored[key] = saved[key];
  }
  return validate(restored as T) ? restored as T : null;
}
