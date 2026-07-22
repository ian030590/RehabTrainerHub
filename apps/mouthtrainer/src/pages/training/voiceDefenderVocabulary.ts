import { storagePrefix } from '../../utils/settings';

export type VoiceLanguage = 'zh' | 'en';

export interface VoiceVocabularyItem {
  id: string;
  word: string;
  language: VoiceLanguage;
  isActive: boolean;
}

const storageKey = `${storagePrefix}voice_defender_vocabulary_v2`;
const legacyStorageKey = `${storagePrefix}voice_defender_vocabulary_v1`;

const defaultChineseCharacters = [
  '蘋', '果', '香', '人', '葡', '大', '小', '子', '草', '莓',
  '西', '瓜', '桃', '梨', '芒', '上', '下', '天', '空', '海',
  '洋', '河', '流', '山', '谷', '森', '林', '花', '朵', '雨',
  '水', '雪', '太', '陽', '月', '亮', '紅', '色', '藍', '綠',
  '黃', '白', '黑', '紫', '橙', '桌', '椅', '杯', '書', '本',
  '鉛', '筆', '眼', '鏡', '電', '話', '腦', '鑰', '匙', '傘',
  '走', '路', '跑', '步', '跳', '躍', '微', '笑', '呼', '吸',
  '說', '左', '聽', '閱', '讀', '寫', '字', '畫', '朋', '友',
  '老', '師',
] as const;

const defaultEnglishWords = [
  'apple', 'banana', 'grape', 'orange', 'strawberry', 'watermelon', 'peach', 'pear', 'mango', 'lemon',
  'sky', 'ocean', 'river', 'valley', 'forest', 'flower', 'rain', 'snow', 'sun', 'moon',
  'red', 'blue', 'green', 'yellow', 'white', 'black', 'purple', 'table', 'chair', 'cup',
  'book', 'pencil', 'glasses', 'phone', 'computer', 'key', 'umbrella', 'walk', 'run', 'jump',
  'smile', 'breathe', 'speak', 'listen', 'read', 'write', 'draw', 'friend', 'teacher', 'family',
] as const;

export function CreateDefaultVoiceVocabulary(): VoiceVocabularyItem[] {
  return [
    ...defaultChineseCharacters.map((word, index) => ({
      id: `zh-${index + 1}`,
      word,
      language: 'zh' as const,
      isActive: true,
    })),
    ...defaultEnglishWords.map((word, index) => ({
      id: `en-${index + 1}`,
      word,
      language: 'en' as const,
      isActive: true,
    })),
  ];
}

export function LoadVoiceVocabulary(): VoiceVocabularyItem[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return CreateDefaultVoiceVocabulary();
      return DeduplicateVocabulary(parsed.flatMap(ToVocabularyItems));
    }

    const defaults = CreateDefaultVoiceVocabulary();
    const legacyRaw = localStorage.getItem(legacyStorageKey);
    if (!legacyRaw) {
      SaveVoiceVocabulary(defaults);
      return defaults;
    }
    const legacyParsed: unknown = JSON.parse(legacyRaw);
    const customItems = Array.isArray(legacyParsed)
      ? legacyParsed.filter((item) => !IsLegacyDefaultItem(item)).flatMap(ToVocabularyItems)
      : [];
    const migrated = DeduplicateVocabulary([...defaults, ...customItems]);
    SaveVoiceVocabulary(migrated);
    return migrated;
  } catch (error) {
    console.warn('Unable to read voice defender vocabulary.', error);
    return CreateDefaultVoiceVocabulary();
  }
}

export function SaveVoiceVocabulary(items: VoiceVocabularyItem[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch (error) {
    console.warn('Unable to save voice defender vocabulary.', error);
  }
}

export function CreateVoiceVocabularyItems(input: string, language: VoiceLanguage): VoiceVocabularyItem[] {
  return SplitVoiceVocabularyInput(input, language).map((word) => ({
    id: `${language}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    word,
    language,
    isActive: true,
  }));
}

export function SplitVoiceVocabularyInput(input: string, language: VoiceLanguage): string[] {
  const normalized = input.normalize('NFKC').trim();
  if (!normalized) return [];
  if (language === 'en') return [normalized.replace(/\s+/g, ' ')];

  return [...new Set(
    [...normalized].filter((character) => /[\p{L}\p{N}]/u.test(character)),
  )];
}

function ToVocabularyItems(value: unknown): VoiceVocabularyItem[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== 'string' ||
    typeof item.word !== 'string' ||
    (item.language !== 'zh' && item.language !== 'en') ||
    typeof item.isActive !== 'boolean'
  ) {
    return [];
  }

  const id = item.id;
  const language = item.language;
  const isActive = item.isActive;
  return SplitVoiceVocabularyInput(item.word, language).map((word, index, entries) => ({
    id: entries.length === 1 ? id : `${id}-${index + 1}`,
    word,
    language,
    isActive,
  }));
}

function DeduplicateVocabulary(items: VoiceVocabularyItem[]): VoiceVocabularyItem[] {
  const deduplicated = new Map<string, VoiceVocabularyItem>();
  items.forEach((item) => {
    const key = `${item.language}:${item.word.toLocaleLowerCase()}`;
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, item);
      return;
    }
    if (!existing.isActive && item.isActive) {
      deduplicated.set(key, { ...existing, isActive: true });
    }
  });
  return [...deduplicated.values()];
}

function IsLegacyDefaultItem(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const id = (value as Record<string, unknown>).id;
  return typeof id === 'string' && /^(?:zh|en)-\d+$/.test(id);
}
