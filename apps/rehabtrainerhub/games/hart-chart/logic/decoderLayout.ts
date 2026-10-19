import type { HartDecoderToken } from './hartChart';

export interface DecoderEntry {
  token: HartDecoderToken;
  index: number;
}

// Space tokens end a word. Each word is laid out as one group that never breaks across lines.
export function SplitDecoderWords(tokens: HartDecoderToken[]): DecoderEntry[][] {
  const words: DecoderEntry[][] = [[]];
  tokens.forEach((token, index) => {
    if (token.char === ' ') words.push([]);
    else words[words.length - 1].push({ token, index });
  });
  return words.filter((word) => word.length > 0);
}

function WordShapes(words: DecoderEntry[][]) {
  return [...new Map(words.map((word) => {
    const fields = word.filter((entry) => entry.token.coordinate).length;
    return [`${fields}:${word.length}`, { fields, plain: word.length - fields, gaps: word.length - 1 }] as const;
  })).values()].filter((shape) => shape.fields > 0);
}

// CSS sizes for the widest word. A word with k fields and s plain characters needs k cells,
// s character widths and a gap between neighbours. Cells shrink with the decoder width (100cqi)
// but not below --hart-cell-min; a side dock grows to --hart-word-need so that minimum still fits.
export function DecoderLayoutStyle(words: DecoderEntry[][]): Record<'--hart-cell-width' | '--hart-word-need', string> {
  const shapes = WordShapes(words);
  const plainWidth = (shape: { plain: number; gaps: number }) => `${shape.plain} * var(--hart-static-width) - ${shape.gaps} * var(--hart-cell-gap)`;
  const fits = shapes.map((shape) => `, (100cqi - ${plainWidth(shape)}) / ${shape.fields}`).join('');
  const needs = shapes.map((shape) => `, ${shape.fields} * var(--hart-cell-min) + ${shape.plain} * var(--hart-static-width) + ${shape.gaps} * var(--hart-cell-gap)`).join('');
  return {
    '--hart-cell-width': `max(var(--hart-cell-min), min(var(--hart-cell-max)${fits}))`,
    '--hart-word-need': `max(0px${needs})`,
  };
}
