import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function Load(sourcePath, imports, fetch) {
  const source = await readFile(new URL(`../${sourcePath}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } });
  const exports = {};
  new Function('exports', 'require', 'fetch', outputText)(exports, (id) => imports[id] ?? require(id), fetch);
  return exports;
}

test('published article bodies and author dates render before browser JavaScript', async () => {
  const article = { id: 'sample', slug: 'sample', title: 'Example title', summary: 'Example summary', content: 'Full article body <safe>', category: 'Information', coverImageUrl: null, status: 'published', authorName: 'Example author', publishedAt: '2026-01-01', updatedAt: '2026-01-02', createdAt: '2026-01-01' };
  let requests = 0;
  const { LoadPublishedArticles } = await Load('apps/rehabtrainerhub/app/qa/loadPublishedArticles.ts', {
    '../siteUrls': { siteUrls: { hub: 'https://example.test' } },
  }, async () => {
    requests++;
    return Response.json(requests === 1 ? { articles: [article, { ...article, status: 'draft' }], nextCursor: null } : { article });
  });
  const initialArticles = await LoadPublishedArticles();
  assert.equal(requests, 2);
  assert.deepEqual(initialArticles, [article]);
  const { EducationArticles } = await Load('apps/rehabtrainerhub/app/qa/EducationArticles.tsx', {
    '@rehab-trainer/ui/auth/authClient': { BuildApiUrl: (_, path) => path },
    '@rehab-trainer/ui/components/CardImagePlaceholder': { CardImagePlaceholder: () => null },
    '../i18n': { GetHubUiCopy: () => ({ educationArticles: {}, educationArticle: {} }) },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en', t: key => key }) },
  });
  const html = renderToStaticMarkup(React.createElement(EducationArticles, { initialArticles }));
  assert.match(html, /Full article body &lt;safe&gt;/);
  assert.match(html, /Example author/);
  assert.match(html, /dateTime="2026-01-02"/);
  assert.doesNotMatch(html, /minimal-loading-spinner/);
});
