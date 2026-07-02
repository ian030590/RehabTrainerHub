export type VoskVocabularyIndex = string;

export async function loadVoskVocabularyIndex(url: string): Promise<VoskVocabularyIndex> {
  if (!url) throw new Error('Vosk vocabulary index URL is not configured.');
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error(`Unable to load Vosk vocabulary index (${response.status}).`);
  }
  const text = (await response.text()).replace(/\r/g, '').trim();
  if (!text) throw new Error('Vosk vocabulary index is empty.');
  return `\n${text}\n`;
}

export function hasVoskVocabularyWord(
  index: VoskVocabularyIndex,
  word: string,
  language: 'zh' | 'en',
): boolean {
  const normalized = normalizeVocabularyWord(word, language);
  return Boolean(normalized) && index.includes(`\n${normalized}\n`);
}

export function normalizeVocabularyWord(word: string, language: 'zh' | 'en'): string {
  const normalized = word.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return language === 'en' ? normalized.toLocaleLowerCase() : normalized;
}
