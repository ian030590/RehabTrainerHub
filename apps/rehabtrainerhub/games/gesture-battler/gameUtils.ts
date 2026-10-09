export const Clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
export const FormatTestDate = (date: Date) => date.toISOString();
