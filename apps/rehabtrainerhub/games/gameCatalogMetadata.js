import { IsGameTagPair } from './gameTags.js';

export const maxGameCatalogBytes = 16 * 1024;

export function ParseGameCatalogMetadata(value, gameId, filePaths) {
  const isRecord = input => input !== null && typeof input === 'object' && !Array.isArray(input);
  const isText = (input, max) => typeof input === 'string' && input.trim().length > 0 && input.length <= max;
  if (!isRecord(value) || value.schemaVersion !== 1 || value.gameId !== gameId
    || !IsGameTagPair(value.trainer, value.category) || !isText(value.author, 120)
    || typeof value.preview !== 'string' || value.preview.length > 256
    || !/^[0-9A-Za-z._-]+(?:\/[0-9A-Za-z._-]+)*\.(?:png|jpe?g|webp|avif)$/i.test(value.preview)
    || value.preview.split('/').some(segment => segment === '.' || segment === '..')
    || !filePaths.has(value.preview) || !isRecord(value.copy)
    || ['zh-TW', 'en'].some(locale => !isRecord(value.copy[locale])
      || !isText(value.copy[locale].title, 120) || !isText(value.copy[locale].description, 500))) {
    throw new Error('Invalid game catalog metadata or preview.');
  }
  return { schemaVersion: 1, gameId, trainer: value.trainer, category: value.category,
    author: value.author, preview: value.preview, copy: Object.fromEntries(['zh-TW', 'en'].map(locale => [locale,
      { title: value.copy[locale].title, description: value.copy[locale].description }])) };
}
