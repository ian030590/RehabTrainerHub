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

test('education shows one blog link without article previews or loading states in either language before JavaScript', async () => {
  const { zhTW } = await Load('apps/rehabtrainerhub/app/i18n/zh-TW.ts', {});
  const { en } = await Load('apps/rehabtrainerhub/app/i18n/en.ts', {});
  for (const [language, dictionary] of [['zh', zhTW], ['en', en]]) {
    const feed = await Load(feedPath, {});
    const { EducationArticles } = await Load('apps/rehabtrainerhub/app/qa/EducationArticles.tsx', {
      './educationFeed': feed,
      '../i18n': { GetHubUiCopy: () => dictionary.hubUi },
      '../i18n/HubLanguage': { useHubLanguage: () => ({ language, locale: language === 'zh' ? 'zh-TW' : 'en', t: (key) => key }) },
    });
    for (const initialArticles of [[], [expectedLink]]) {
      const html = renderToStaticMarkup(React.createElement(EducationArticles, { initialArticles }));
      assert.match(html, /href="https:\/\/ian\.trainerhub\.cc\/blog"/);
      assert.equal((html.match(/<a\b/g) ?? []).length, 1);
      assert.match(html, /target="_blank"/);
      assert.match(html, /rel="noopener"/);
      assert.ok(html.includes(dictionary.hubUi.educationArticles.blogLink));
      assert.ok(html.includes(dictionary.hubUi.educationArticles.opensInNewTab));
      assert.doesNotMatch(html, /education-article-list|education-article-summary|role="status"|role="alert"|<time\b|blog\.trainerhub\.cc/);
      assert.doesNotMatch(html, /凝視穩定運動|頭動時的視覺困難/);
    }
  }
});

test('the FAQ renders the blog and separate author website links without loading an article feed', async () => {
  const { zhTW } = await Load('apps/rehabtrainerhub/app/i18n/zh-TW.ts', {});
  const imports = {
    '../i18n': { GetHubUiCopy: () => zhTW.hubUi },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'zh', locale: 'zh-TW', t: (key) => key }) },
    './educationFeed': await Load(feedPath, {}),
  };
  const education = await Load('apps/rehabtrainerhub/app/qa/EducationArticles.tsx', imports);
  const questions = await Load('apps/rehabtrainerhub/app/qa/QuestionsContent.tsx', {
    ...imports,
    './EducationArticles': education,
  });
  const requests = [];
  const { default: QuestionsPage } = await Load('apps/rehabtrainerhub/app/qa/page.tsx', {
    './QuestionsContent': questions,
    './educationFeed': { LoadEducationLinks: async () => { requests.push('/api/education-feed'); return [expectedLink]; } },
    '../seo': {
      CreateSeoMetadata: () => ({}),
      CreatePageJsonLd: (value) => value,
      maintainerPageJsonLd: {},
      SerializeJsonLd: JSON.stringify,
    },
  });
  const html = renderToStaticMarkup(await QuestionsPage());
  assert.deepEqual(requests, []);
  assert.match(html, /href="https:\/\/ian\.trainerhub\.cc\/blog"/);
  assert.match(html, /href="https:\/\/ian\.trainerhub\.cc\/" rel="me"/);
  assert.match(html, /id="professional-background"/);
  assert.match(html, /<h1>常見問答<\/h1>/);
  assert.doesNotMatch(html, /education-article-list|凝視穩定運動/);
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
