import type { DifficultyPreset, HazardTemplate } from './types';

export const DIFFICULTY_PRESETS: Record<string, DifficultyPreset> = {
  beginner: { hazardTimeoutMs: 5200, hazardLeadDistance: 40, minHazardInterval: 50, maxHazardInterval: 90 },
  intermediate: { hazardTimeoutMs: 3200, hazardLeadDistance: 30, minHazardInterval: 35, maxHazardInterval: 65 },
  advanced: { hazardTimeoutMs: 1800, hazardLeadDistance: 22, minHazardInterval: 25, maxHazardInterval: 50 },
};

export const HAZARD_TEMPLATES: readonly HazardTemplate[] = [
  { id: 'child-crossing' },
  { id: 'plane-crash' },
  { id: 'drunk-driver' },
  { id: 'elder-stopped' },
  { id: 'wrong-way-driver' },
];
