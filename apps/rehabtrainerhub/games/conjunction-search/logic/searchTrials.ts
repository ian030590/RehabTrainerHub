import { levels, type Stimulus } from './levels';
import { LayoutItems, type SearchField, type Position } from './layout';
import type { SearchSettings } from '../settings';
import type { TrialTiming } from './trialRun';

export interface SearchItem extends Position, Stimulus { target: boolean }
export interface SearchTrial { block: number; setSize: number; present: boolean; targetQuadrant: number | null; items: SearchItem[] }

export function CreateRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function Shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}

export function CreateSearchBlocks(settings: SearchSettings, random: () => number, field: SearchField): SearchTrial[][] {
  const level = levels[settings.level - 1];
  return [8, 16, 24].map((setSize, blockIndex) => {
    const offset = Math.floor(random() * 4);
    const quadrants = Shuffle(Array.from({ length: settings.trialsPerBlock / 2 }, (_, i) => (i + offset) % 4), random);
    const targets = Shuffle([...quadrants, ...Array<number | null>(settings.trialsPerBlock / 2).fill(null)], random);
    let replaced = 0;
    return targets.map(targetQuadrant => {
      const items = LayoutItems(setSize, field, random).map((position, i) => ({ ...position, ...level.distractors[(i % (setSize / 4)) % level.distractors.length], target: false }));
      if (targetQuadrant !== null) {
        const kind = replaced++ % level.distractors.length;
        const candidates = items.filter(item => item.quadrant === targetQuadrant && item.glyph === level.distractors[kind].glyph && item.tone === level.distractors[kind].tone);
        Object.assign(candidates[Math.floor(random() * candidates.length)], level.target, { target: true });
      }
      return { block: blockIndex + 1, setSize, present: targetQuadrant !== null, targetQuadrant, items };
    });
  });
}

export function SearchTiming(timeLimitMs: number): TrialTiming {
  return { lead: [{ state: 'lead', ms: 500 }], exposureMs: null, windowMs: timeLimitMs || null, endOnResponse: true, feedbackMs: 500, gapMs: 300 };
}
