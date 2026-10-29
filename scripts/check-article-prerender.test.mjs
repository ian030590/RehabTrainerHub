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
const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>凝視穩定運動 &amp; 生活目標</title>
    <link>https://ian030590.trainerhub.cc/content/VisualRehab/030_%E5%87%9D%E8%A6%96</link>
    <pubDate>Thu, 15 Oct 2026 08:00:00 +0800</pubDate>
    <description><![CDATA[頭動時的視覺困難 <與練習>]]></description>
    <author>owner@example.test (蔡泓恩 職能治療師)</author>
    <category>視覺復健</category>
    <category>動作復健</category>
  </item>
  <item>
    <title>AI 產品軟體架構</title>
    <link>https://ian030590.trainerhub.cc/content/DigitLearn/009_AI</link>
    <pubDate>Sat, 12 Sep 2026 08:00:00 +0800</pubDate>
    <description>軟體架構</description>
    <category>AI應用</category>
  </item>
  <item>
    <title>電子擴視科技</title>
    <link>https://ian.trainerhub.cc/content/VisualRehab/025</link>
    <pubDate>Sat, 12 Sep 2026 08:00:00 +0800</pubDate>
    <description>擴視機&#x8207;&#33258;動朗讀</description>
    <category>AI應用</category>
    <category>視覺復健</category>
  </item>
  <item>
    <title>偽造連結</title>
    <link>javascript:alert(1)</link>
    <category>中風復健</category>
  </item>
  <item>
    <title>他站連結</title>
    <link>https://example.test/content/a</link>
    <category>中風復健</category>
  </item>
  <item>
    <title>非加密連結</title>
    <link>http://ian.trainerhub.cc/content/b</link>
    <category>中風復健</category>
  </item>
</channel></rss>`;

const expectedLink = {
  title: '凝視穩定運動 & 生活目標',
  summary: '頭動時的視覺困難 <與練習>',
  url: 'https://ian030590.trainerhub.cc/content/VisualRehab/030_%E5%87%9D%E8%A6%96',
  categories: ['視覺復健', '動作復健'],
  authorName: '蔡泓恩',
  publishedAt: '2026-10-15T00:00:00.000Z',
};

test('education feed keeps health articles from the personal site and drops unsafe links', async () => {
  const { ParseEducationFeed } = await Load(feedPath, {});
  assert.deepEqual(ParseEducationFeed(feedXml), [expectedLink, {
    title: '電子擴視科技',
    summary: '擴視機與自動朗讀',
    url: 'https://ian.trainerhub.cc/content/VisualRehab/025',
    categories: ['視覺復健'],
    authorName: '',
    publishedAt: '2026-09-12T00:00:00.000Z',
  }]);
  assert.deepEqual(ParseEducationFeed('<html>not a feed</html>'), []);
});

test('build-time loader reads the personal-site feed and survives an outage', async () => {
  const requests = [];
  const { LoadEducationLinks, educationFeedUrl } = await Load(feedPath, {}, async (url) => {
    requests.push(String(url));
    return new Response(feedXml, { headers: { 'Content-Type': 'application/xml' } });
  });
  assert.equal(educationFeedUrl, 'https://ian.trainerhub.cc/rss.xml');
  assert.deepEqual((await LoadEducationLinks())[0], expectedLink);
  assert.deepEqual(requests, [educationFeedUrl]);

  const warn = console.warn;
  console.warn = () => {};
  try {
    const offline = await Load(feedPath, {}, async () => new Response('down', { status: 503 }));
    assert.deepEqual(await offline.LoadEducationLinks(), []);
  } finally {
    console.warn = warn;
  }
});

test('the browser refreshes the list through the Hub instead of a cross-site request', async () => {
  // The personal site sends no CORS headers, so a direct browser fetch of its rss.xml always fails.
  const requests = [];
  const feed = await Load(feedPath, {}, async (url) => {
    requests.push(String(url));
    return Response.json({ xml: feedXml });
  });
  assert.equal(feed.educationFeedProxyPath, '/api/education-feed');
  assert.deepEqual((await feed.FetchEducationLinks())[0], expectedLink);
  assert.deepEqual(requests, ['/api/education-feed']);

  const failing = await Load(feedPath, {}, async () => Response.json({ error: 'x' }, { status: 502 }));
  await assert.rejects(failing.FetchEducationLinks(), /502/);
  const malformed = await Load(feedPath, {}, async () => Response.json({ xml: 42 }));
  await assert.rejects(malformed.FetchEducationLinks(), /Invalid/);
});

test('education links render as outbound personal-site links before browser JavaScript', async () => {
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
  assert.match(html, /href="https:\/\/ian030590\.trainerhub\.cc\/content\/VisualRehab\/030_%E5%87%9D%E8%A6%96"/);
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
