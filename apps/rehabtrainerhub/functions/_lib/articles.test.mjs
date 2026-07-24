import assert from 'node:assert/strict';
import {
  GetPublishedArticles,
  InvalidateArticleCache,
  NormalizeArticleInput,
} from './articles.js';

assert.deepEqual(
  NormalizeArticleInput({
    title: '居家訓練安全原則',
    summary: '開始前先確認環境安全。',
    content: '請依治療師建議進行訓練。',
    category: '安全',
    status: 'published',
  }, { fallbackSlug: 'article-safe-training' }),
  {
    slug: 'article-safe-training',
    title: '居家訓練安全原則',
    summary: '開始前先確認環境安全。',
    content: '請依治療師建議進行訓練。',
    category: '安全',
    coverImageUrl: null,
    status: 'published',
  },
);
assert.equal(NormalizeArticleInput({
  slug: 'unsafe',
  title: 'Unsafe',
  content: 'Body',
  status: 'archived',
}), null);
assert.equal(NormalizeArticleInput({
  slug: 'unsafe',
  title: 'Unsafe',
  content: 'Body',
  coverImageUrl: 'http://example.test/image.png',
}), null);

const rows = [{
  id: 'article-1',
  slug: 'safe-training',
  title: 'Safe training',
  summary: 'Summary',
  content: 'Content',
  category: 'Safety',
  cover_image_url: null,
  status: 'published',
  author_name: 'Therapist',
  published_at: '2026-07-24T00:00:00.000Z',
  created_at: '2026-07-24T00:00:00.000Z',
  updated_at: '2026-07-24T00:00:00.000Z',
}];
let databaseReads = 0;
let cacheValue = null;
let invalidations = 0;
const env = {
  REHAB_DB: {
    prepare(sql) {
      assert.match(sql, /status = 'published'/);
      return {
        bind() {
          return {
            async all() {
              databaseReads += 1;
              return { results: rows };
            },
          };
        },
      };
    },
  },
  ARTICLE_CACHE: {
    async get() {
      return cacheValue ? JSON.parse(cacheValue) : null;
    },
    async put(_key, value) {
      cacheValue = value;
    },
    async delete() {
      cacheValue = null;
      invalidations += 1;
    },
  },
};

const firstRead = await GetPublishedArticles(env);
const secondRead = await GetPublishedArticles(env);
assert.equal(firstRead[0].coverImageUrl, null);
assert.deepEqual(secondRead, firstRead);
assert.equal(databaseReads, 1);

await InvalidateArticleCache(env);
assert.equal(invalidations, 1);
await GetPublishedArticles(env);
assert.equal(databaseReads, 2);

console.log('article helper checks passed');
