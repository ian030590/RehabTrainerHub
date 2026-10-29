import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
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

const feedPath = 'apps/rehabtrainerhub/app/qa/educationFeed.ts';
const expectedLink = {
  title: '凝視穩定運動 & 生活目標',
  summary: '頭動時的視覺困難 <與練習>',
  url: 'https://blog.trainerhub.cc/2026/09/blog-post_164.html',
  categories: ['視覺復健', '動作復健'],
  authorName: '蔡泓恩',
  publishedAt: '2026-10-15T00:00:00.000Z',
};

test('the browser reads validated JSON from the same-origin Hub endpoint and forwards cancellation', async () => {
  const requests = [];
  const controller = new AbortController();
  const feed = await Load(feedPath, {}, async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json({ links: [expectedLink] });
  });
  assert.equal(feed.educationFeedProxyPath, '/api/education-feed');
  assert.deepEqual(await feed.FetchEducationLinks(controller.signal), [expectedLink]);
  assert.deepEqual(requests.map(request => request.url), ['/api/education-feed']);
  assert.equal(requests[0].init.signal, controller.signal);
  assert.equal(new Headers(requests[0].init.headers).get('Accept'), 'application/json');
});

test('the JSON validator drops malformed items and foreign links, normalises categories and HTTPS, sorts and de-duplicates', async () => {
  const newerLink = {
    ...expectedLink, title: '較新的文章', summary: '😀'.repeat(160), url: 'https://blog.trainerhub.cc/new',
    publishedAt: '2026-10-20T00:00:00.000Z', categories: ['中風復健', '認知復健'],
  };
  const feed = await Load(feedPath, {}, async () => Response.json({ links: [
    expectedLink,
    { ...newerLink, url: 'http://blog.trainerhub.cc/new', categories: ['認知復健', 'AI應用', '中風復健', '認知復健'] },
    newerLink,
    ...[null, [], 'bad', {},
      { ...expectedLink, title: 42 }, { ...expectedLink, title: '   ' },
      { ...expectedLink, title: '<b>Title</b>' }, { ...expectedLink, summary: '<p>Raw HTML</p>' },
      { ...expectedLink, summary: '字'.repeat(161) }, { ...expectedLink, summary: false },
      { ...expectedLink, authorName: {} }, { ...expectedLink, publishedAt: 'not a date' },
      { ...expectedLink, publishedAt: 42 }, { ...expectedLink, categories: ['AI應用', '數位學習'] },
      { ...expectedLink, categories: '視覺復健' }, { ...expectedLink, categories: ['視覺復健', 42] },
      { ...expectedLink, url: 'javascript:alert(1)' }, { ...expectedLink, url: 'https://foreign.example/a' },
      { ...expectedLink, url: 'https://ian.trainerhub.cc/old' },
      { ...expectedLink, url: 'https://blog.trainerhub.cc.evil.test/a' },
      { ...expectedLink, url: 'https://blog.trainerhub.cc:444/a' },
      { ...expectedLink, url: 'https://fake-user:fake-password@blog.trainerhub.cc/a' },
      { ...expectedLink, url: 'ftp://blog.trainerhub.cc/a' },
    ].map((item, index) => item && typeof item === 'object' && !Array.isArray(item)
      ? { ...item, url: item.url === expectedLink.url ? `https://blog.trainerhub.cc/invalid${index}` : item.url }
      : item),
  ] }));
  assert.deepEqual(feed.educationCategories, ['中風復健', '視覺復健', '動作復健', '認知復健']);
  assert.deepEqual(await feed.FetchEducationLinks(), [newerLink, expectedLink]);
});

test('the browser rejects non-object or malformed bodies, the old XML shape, and HTTP failures', async () => {
  for (const body of [null, [], 'bad', { xml: '<rss/>' }, { links: 'bad' }, {}]) {
    const feed = await Load(feedPath, {}, async () => Response.json(body));
    await assert.rejects(feed.FetchEducationLinks(), /Invalid education feed response/);
  }
  const failing = await Load(feedPath, {}, async () => Response.json({ error: 'x' }, { status: 502 }));
  await assert.rejects(failing.FetchEducationLinks(), /502/);
  const empty = await Load(feedPath, {}, async () => Response.json({ links: [] }));
  assert.deepEqual(await empty.FetchEducationLinks(), []);
});

test('the build loader reads the production Hub JSON endpoint with a ten-second timeout and the same validation', async (t) => {
  const requests = [];
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const { LoadEducationLinks } = await Load(feedPath, {}, async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json({ links: [expectedLink, { ...expectedLink, url: 'https://foreign.example/a' }] });
  });
  assert.deepEqual(await LoadEducationLinks(), [expectedLink]);
  assert.deepEqual(requests.map(request => request.url), ['https://trainerhub.cc/api/education-feed']);
  assert.equal(new Headers(requests[0].init.headers).get('Accept'), 'application/json');
  assert.equal(new Headers(requests[0].init.headers).has('Origin'), false);
  assert.ok(requests[0].init.signal instanceof AbortSignal);
  assert.deepEqual(timeouts, [10_000]);
});

test('prerender warns and returns an empty list for the old XML response, invalid JSON, HTTP errors and network failures', async (t) => {
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  const cases = [
    () => Response.json({ xml: '<rss/>' }),
    () => Response.json(null),
    () => new Response('bad json', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('down', { status: 503 }),
    () => { throw new TypeError('network down'); },
  ];
  for (const upstream of cases) {
    const { LoadEducationLinks } = await Load(feedPath, {}, upstream);
    assert.deepEqual(await LoadEducationLinks(), []);
  }
  assert.equal(warnings.length, cases.length);
  assert.ok(warnings.every(args => args[0] === 'Could not prerender education links:'));
});

test('education links render as outbound blog links before browser JavaScript', async () => {
  const feed = await Load(feedPath, {});
  const { EducationArticles } = await Load('apps/rehabtrainerhub/app/qa/EducationArticles.tsx', {
    './educationFeed': feed,
    '../i18n': { GetHubUiCopy: () => ({
      educationArticles: { sourceNote: 'Source note', categories: { 視覺復健: 'Vision' } },
      educationArticle: { author: 'By', published: 'Published', opensInNewTab: '(opens in a new tab)' },
    }) },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en', t: (key) => key }) },
  });
  const html = renderToStaticMarkup(React.createElement(EducationArticles, { initialArticles: [expectedLink] }));
  assert.match(html, /href="https:\/\/blog\.trainerhub\.cc\/2026\/09\/blog-post_164\.html"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener"/);
  assert.match(html, /凝視穩定運動 &amp; 生活目標/);
  assert.match(html, /頭動時的視覺困難 &lt;與練習&gt;/);
  assert.match(html, /\(opens in a new tab\)/);
  assert.match(html, />Vision</);
  assert.match(html, />動作復健</);
  assert.match(html, /href="#professional-background">蔡泓恩</);
  assert.match(html, /dateTime="2026-10-15T00:00:00.000Z"/);
  assert.match(html, /Source note/);
  assert.doesNotMatch(html, /minimal-loading-spinner/);
  assert.doesNotMatch(html, /<details/);
});

test('an empty build-time list shows loading instead of claiming there are no articles', async () => {
  const feed = await Load(feedPath, {});
  const { EducationArticles } = await Load('apps/rehabtrainerhub/app/qa/EducationArticles.tsx', {
    './educationFeed': feed,
    '../i18n': { GetHubUiCopy: () => ({
      educationArticles: { sourceNote: 'Source note', loading: 'Loading articles', emptyTitle: 'No articles yet', categories: {} },
      educationArticle: { author: 'By', published: 'Published', opensInNewTab: '(opens in a new tab)' },
    }) },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en', t: (key) => key }) },
  });
  const html = renderToStaticMarkup(React.createElement(EducationArticles, { initialArticles: [] }));
  assert.match(html, /role="status"[^>]*>.*Loading articles/);
  assert.doesNotMatch(html, /No articles yet/);
});

test('both languages describe the article blog while the author website link stays separate', async () => {
  const { zhTW } = await Load('apps/rehabtrainerhub/app/i18n/zh-TW.ts', {});
  const { en } = await Load('apps/rehabtrainerhub/app/i18n/en.ts', {});
  assert.equal(zhTW.hubUi.educationArticles.sourceNote, '以下文章刊登在作者的部落格，點標題會在新分頁開啟全文。');
  assert.equal(zhTW.hubUi.educationArticles.emptyBody, '作者部落格發布相關文章後，會列在這裡。');
  assert.match(en.hubUi.educationArticles.sourceNote, /author's blog/);
  assert.match(en.hubUi.educationArticles.emptyBody, /author's blog/);
  const questions = await readFile(new URL('../apps/rehabtrainerhub/app/qa/QuestionsContent.tsx', import.meta.url), 'utf8');
  assert.match(questions, /const personalWebsiteUrl = 'https:\/\/ian\.trainerhub\.cc\/'/);
});

test('the Hub no longer hosts its own article authoring', async () => {
  const removed = [
    'apps/rehabtrainerhub/functions/_lib/articles.js',
    'apps/rehabtrainerhub/functions/api/articles.js',
    'apps/rehabtrainerhub/functions/api/articles/[slug].js',
    'apps/rehabtrainerhub/functions/api/admin/articles.js',
    'apps/rehabtrainerhub/functions/api/admin/articles/[id].js',
    'apps/rehabtrainerhub/functions/api/admin/assets.js',
    'apps/rehabtrainerhub/app/admin/ArticleManager.tsx',
    'apps/rehabtrainerhub/app/articleTypes.ts',
  ];
  for (const path of removed) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)), { code: 'ENOENT' }, path);
  }
  const dashboard = await readFile(new URL('../apps/rehabtrainerhub/app/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(dashboard, /ArticleManager|衛教文章|'articles'/);
  const adminApi = await readFile(new URL('../apps/rehabtrainerhub/app/admin/adminApi.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(adminApi, /\/api\/admin\/(articles|assets)/);
});
