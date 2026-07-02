import { pinyin } from 'pinyin-pro';

export const VOICE_MATCH_SIMILARITY_THRESHOLD = 0.3;

export function normalizeSpeechText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function buildVoskGrammar(
  words: string[],
  language: 'zh' | 'en',
): string {
  const phrases = words
    .map((word) => word.normalize('NFKC').trim().replace(/\s+/g, ' '))
    .map((word) => language === 'en' ? word.toLocaleLowerCase() : word)
    .filter(Boolean);
  return JSON.stringify([...new Set([...phrases, '[unk]'])]);
}

export function calculateBestSpeechSimilarity(transcript: string, target: string): number {
  const usePinyin = containsHanCharacter(target);
  const normalizedTarget = usePinyin
    ? normalizeSpeechPronunciation(target)
    : normalizeSpeechText(target);
  const candidates = usePinyin
    ? buildPinyinCandidates(transcript, getPinyinSyllables(target).length)
    : new Set([
        normalizeSpeechText(transcript),
        ...transcript
          .split(/[\s,.;:!?，。！？、；：]+/u)
          .map(normalizeSpeechText),
      ]);
  return Math.max(
    0,
    ...[...candidates]
      .filter(Boolean)
      .map((candidate) => calculateSimilarity(candidate, normalizedTarget)),
  );
}

export function normalizeSpeechPronunciation(value: string): string {
  return normalizeSpeechText(pinyin(value.normalize('NFKC'), {
    toneType: 'none',
    traditional: true,
    nonZh: 'consecutive',
    separator: '',
    v: true,
  }));
}

function buildPinyinCandidates(transcript: string, targetSyllableCount: number): Set<string> {
  const syllables = getPinyinSyllables(transcript);
  const candidates = new Set<string>([
    normalizeSpeechPronunciation(transcript),
    ...syllables,
  ]);
  const windowSize = Math.max(1, targetSyllableCount);
  for (let index = 0; index <= syllables.length - windowSize; index += 1) {
    candidates.add(syllables.slice(index, index + windowSize).join(''));
  }
  return candidates;
}

function getPinyinSyllables(value: string): string[] {
  return pinyin(value.normalize('NFKC'), {
    toneType: 'none',
    type: 'array',
    traditional: true,
    nonZh: 'consecutive',
    v: true,
  }).flatMap((part) => part.split(/[^\p{L}\p{N}]+/u))
    .map(normalizeSpeechText)
    .filter(Boolean);
}

function containsHanCharacter(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return [...b].length;
  if (!b) return [...a].length;
  const left = [...a];
  const right = [...b];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  left.forEach((leftChar, leftIndex) => {
    const current = [leftIndex + 1];
    right.forEach((rightChar, rightIndex) => {
      current[rightIndex + 1] = Math.min(
        current[rightIndex] + 1,
        previous[rightIndex + 1] + 1,
        previous[rightIndex] + (leftChar === rightChar ? 0 : 1),
      );
    });
    previous = current;
  });

  return previous[right.length];
}

export function calculateSimilarity(a: string, b: string): number {
  const maxLength = Math.max([...a].length, [...b].length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}
