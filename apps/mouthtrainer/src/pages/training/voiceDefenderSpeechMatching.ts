import { pinyin } from 'pinyin-pro';

export const voiceMatchSimilarityThreshold = 0.3;

export function NormalizeSpeechText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function BuildVoskGrammar(
  words: string[],
  language: 'zh' | 'en',
): string {
  const phrases = words
    .map((word) => word.normalize('NFKC').trim().replace(/\s+/g, ' '))
    .map((word) => language === 'en' ? word.toLocaleLowerCase() : word)
    .filter(Boolean);
  return JSON.stringify([...new Set([...phrases, '[unk]'])]);
}

export function CalculateBestSpeechSimilarity(transcript: string, target: string): number {
  const usePinyin = ContainsHanCharacter(target);
  const normalizedTarget = usePinyin
    ? NormalizeSpeechPronunciation(target)
    : NormalizeSpeechText(target);
  const candidates = usePinyin
    ? BuildPinyinCandidates(transcript, GetPinyinSyllables(target).length)
    : new Set([
        NormalizeSpeechText(transcript),
        ...transcript
          .split(/[\s,.;:!?，。！？、；：]+/u)
          .map(NormalizeSpeechText),
      ]);
  return Math.max(
    0,
    ...[...candidates]
      .filter(Boolean)
      .map((candidate) => CalculateSimilarity(candidate, normalizedTarget)),
  );
}

export function NormalizeSpeechPronunciation(value: string): string {
  return NormalizeSpeechText(pinyin(value.normalize('NFKC'), {
    toneType: 'none',
    traditional: true,
    nonZh: 'consecutive',
    separator: '',
    v: true,
  }));
}

function BuildPinyinCandidates(transcript: string, targetSyllableCount: number): Set<string> {
  const syllables = GetPinyinSyllables(transcript);
  const candidates = new Set<string>([
    NormalizeSpeechPronunciation(transcript),
    ...syllables,
  ]);
  const windowSize = Math.max(1, targetSyllableCount);
  for (let index = 0; index <= syllables.length - windowSize; index += 1) {
    candidates.add(syllables.slice(index, index + windowSize).join(''));
  }
  return candidates;
}

function GetPinyinSyllables(value: string): string[] {
  return pinyin(value.normalize('NFKC'), {
    toneType: 'none',
    type: 'array',
    traditional: true,
    nonZh: 'consecutive',
    v: true,
  }).flatMap((part) => part.split(/[^\p{L}\p{N}]+/u))
    .map(NormalizeSpeechText)
    .filter(Boolean);
}

function ContainsHanCharacter(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

export function LevenshteinDistance(a: string, b: string): number {
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

export function CalculateSimilarity(a: string, b: string): number {
  const maxLength = Math.max([...a].length, [...b].length);
  if (maxLength === 0) return 1;
  return 1 - LevenshteinDistance(a, b) / maxLength;
}
