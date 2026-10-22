import type { SortingSettings } from '../settings';

export const colors = ['red', 'green', 'yellow', 'blue'] as const;
export const shapes = ['triangle', 'star', 'cross', 'circle'] as const;
export const rules = ['color', 'shape', 'count'] as const;
export type CardColor = typeof colors[number];
export type CardShape = typeof shapes[number];
export type Rule = typeof rules[number];
export interface Card { color: CardColor; shape: CardShape; count: number }
export interface SortRow {
  trial: number; rule: number; cardColor: number; cardShape: number; cardCount: number; chosen: number;
  correct: boolean; perseverative: boolean; category: number; rtMs: number;
}
export interface SortOutcome { correct: boolean; perseverative: boolean; categoryComplete: boolean; finished: boolean }

// Key card n has n shapes, so colour, shape and count each point to one pile.
export const keyCards: Card[] = colors.map((color, index) => ({ color, shape: shapes[index], count: index + 1 }));

export function CreateRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function Shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

const SameCard = (a: Card, b: Card | undefined) => Boolean(b) && a.color === b!.color && a.shape === b!.shape && a.count === b!.count;

// Only cards whose colour, shape and count all point to different piles are used,
// so any pile shares at most one feature with the card and every sort reads one way.
const unambiguousCards: Card[] = colors.flatMap((color, colorIndex) => shapes.flatMap((shape, shapeIndex) => [1, 2, 3, 4]
  .filter(count => new Set([colorIndex, shapeIndex, count - 1]).size === 3).map(count => ({ color, shape, count }))));

export function CreateCardDeck(maxCards: number, random: () => number): Card[] {
  const deck: Card[] = [];
  while (deck.length < maxCards) {
    const block = Shuffle(unambiguousCards, random);
    if (SameCard(block[0], deck.at(-1))) [block[0], block[1]] = [block[1], block[0]];
    deck.push(...block);
  }
  return deck.slice(0, maxCards);
}

export function MatchedDimension(card: Card, key: Card): Rule | null {
  return rules.find(rule => card[rule] === key[rule]) ?? null;
}

// The rule changes without warning after a run of correct sorts: colour, shape, number, then colour again.
export class CardSorting {
  categoriesCompleted = 0;
  streak = 0;
  trials = 0;
  private ruleIndex = 0;
  private previousRule: Rule | null = null;

  constructor(private settings: SortingSettings) {}

  get rule(): Rule { return rules[this.ruleIndex % rules.length]; }
  get ruleCode() { return this.ruleIndex % rules.length; }
  get finished() { return this.categoriesCompleted >= this.settings.categories || this.trials >= this.settings.maxCards; }

  sort(card: Card, keyIndex: number): SortOutcome {
    const matched = MatchedDimension(card, keyCards[keyIndex]);
    const correct = matched === this.rule;
    const perseverative = !correct && matched !== null && matched === this.previousRule;
    let categoryComplete = false;
    this.trials++;
    if (correct) {
      this.streak++;
      if (this.streak === this.settings.runLength) {
        categoryComplete = true;
        this.categoriesCompleted++;
        this.previousRule = this.rule;
        this.ruleIndex++;
        this.streak = 0;
      }
    } else this.streak = 0;
    return { correct, perseverative, categoryComplete, finished: this.finished };
  }
}

const Round = (value: number | null, digits = 0) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

// An error after five or more correct sorts in a row, before the rule changed, counts as losing the rule.
export function SummarizeSorting(rows: SortRow[], settings: SortingSettings) {
  let streak = 0, categoriesCompleted = 0, failuresToMaintainSet = 0;
  let cardsToFirstCategory: number | null = null;
  for (const [index, row] of rows.entries()) {
    if (row.correct) {
      streak++;
      if (streak === settings.runLength) {
        categoriesCompleted++;
        streak = 0;
        cardsToFirstCategory ??= index + 1;
      }
      continue;
    }
    if (streak >= 5) failuresToMaintainSet++;
    streak = 0;
  }
  const correct = rows.filter(row => row.correct).length;
  const perseverativeErrors = rows.filter(row => row.perseverative).length;
  const rts = rows.map(row => row.rtMs);
  return {
    cardsUsed: rows.length,
    correct,
    errors: rows.length - correct,
    accuracyPercent: rows.length ? Round(correct / rows.length * 100, 1) : null,
    categoriesCompleted,
    perseverativeErrors,
    nonPerseverativeErrors: rows.length - correct - perseverativeErrors,
    perseverativePercent: rows.length ? Round(perseverativeErrors / rows.length * 100, 1) : null,
    cardsToFirstCategory,
    failuresToMaintainSet,
    meanRtMs: rts.length ? Round(rts.reduce((sum, value) => sum + value, 0) / rts.length) : null,
  };
}
