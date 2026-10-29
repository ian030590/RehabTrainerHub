import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestOptions } from './education-feed.js';

const blogPostsUrl = 'https://www.googleapis.com/blogger/v3/blogs/8849463716377519690/posts';
const cacheUrl = 'https://trainerhub.cc/api/education-feed?cache=blogger-v1';
const env = { BLOGGER_API_KEY: 'fake-blogger-key-test-only' };
const maximumPageBytes = 2 * 1024 * 1024;
const post = {
  id: 'post-1',
  title: '居家活動',
  content: '<p>每天的活動</p><p>完整文章</p>',
  url: 'https://blog.trainerhub.cc/2026/09/blog-post_164.html',
  labels: ['動作復健'],
  published: '2026-09-15T08:00:00+08:00',
  author: { displayName: '蔡泓恩' },
};
const expectedLink = {
  title: '居家活動', summary: '每天的活動', url: post.url,
  categories: ['動作復健'], authorName: '蔡泓恩', publishedAt: '2026-09-15T00:00:00.000Z',
};

function Request(url = 'https://trainerhub.cc/api/education-feed', headers = {}) {
  return new globalThis.Request(url, { headers });
}

function StubUpstream(t, upstream = () => Response.json({ items: [post] })) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    calls.push({ url: String(input instanceof globalThis.Request ? input.url : input), init });
    return upstream(input, init);
  });
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  return { calls, warnings };
}

async function AssertUnavailable(response, status = 502) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: 'The education feed is unavailable.' });
}

function StubCache(t, cache) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: cache } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'caches', descriptor);
    else delete globalThis.caches;
  });
}

test('Origin-less build requests read the fixed Blogger blog with a header-only key and bounded JSON requests', async (t) => {
  const { calls } = StubUpstream(t);
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    timeouts.push(milliseconds);
    return new AbortController().signal;
  });
  const response = await onRequestGet({ request: Request(), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { links: [expectedLink] });
  assert.match(response.headers.get('Content-Type'), /^application\/json/);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=600');
  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(`${url.origin}${url.pathname}`, blogPostsUrl);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    maxResults: '50', fetchBodies: 'true', fetchImages: 'false', orderBy: 'published',
    fields: 'nextPageToken,items(id,title,content,url,labels,published,author/displayName)',
  });
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get('X-Goog-Api-Key'), env.BLOGGER_API_KEY);
  assert.equal(headers.get('Accept'), 'application/json');
  assert.ok(!calls[0].url.includes(env.BLOGGER_API_KEY));
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.deepEqual(timeouts, [8000]);
});

test('a missing Blogger key returns 503 without fetching or logging credentials', async (t) => {
  const { calls, warnings } = StubUpstream(t);
  for (const key of [undefined, '', '   ']) {
    await AssertUnavailable(await onRequestGet({ request: Request(), env: { BLOGGER_API_KEY: key } }), 503);
  }
  assert.equal(calls.length, 0);
  assert.equal(warnings.length, 3);
  assert.ok(!JSON.stringify(warnings).includes(env.BLOGGER_API_KEY));
});

test('query parameters cannot change the blog, pagination, fields or API key', async (t) => {
  const { calls } = StubUpstream(t);
  const request = Request('https://trainerhub.cc/api/education-feed?url=http://127.0.0.1/&blogId=other&pageToken=attacker&key=fake-query-key&fields=all');
  assert.equal((await onRequestGet({ request, env })).status, 200);
  const url = new URL(calls[0].url);
  assert.equal(`${url.origin}${url.pathname}`, blogPostsUrl);
  assert.equal(url.searchParams.has('pageToken'), false);
  assert.equal(url.searchParams.has('key'), false);
  assert.equal(new Headers(calls[0].init.headers).get('X-Goog-Api-Key'), env.BLOGGER_API_KEY);
});

test('only the four education labels are kept, in the existing category order', async (t) => {
  StubUpstream(t, () => Response.json({ items: [
    { ...post, labels: ['AI應用', '數位學習'] },
    { ...post, url: 'https://blog.trainerhub.cc/all', labels: ['認知復健', '動作復健', '視覺復健', '中風復健', '視覺復健', 'AI應用'] },
    { ...post, url: 'https://blog.trainerhub.cc/vision', labels: ['AI應用', '視覺復健'] },
    { ...post, url: 'https://blog.trainerhub.cc/stroke', labels: ['中風復健'] },
    { ...post, labels: null }, null,
  ] }));
  const { links } = await (await onRequestGet({ request: Request(), env })).json();
  assert.deepEqual(links.map(link => link.categories), [
    ['中風復健', '視覺復健', '動作復健', '認知復健'], ['視覺復健'], ['中風復健'],
  ]);
});

test('posts become plain text summaries, HTTPS blog links, ISO dates and newest-first unique entries', async (t) => {
  StubUpstream(t, () => Response.json({ items: [
    { ...post, title: ' Older ', content: '<div>fallback&nbsp;&#33258;&#x52D5;</div>', published: '2026-09-01', author: {} },
    { ...post, title: ' <b>視覺</b> &amp; &quot;活動&quot; &apos;目標&apos; ',
      content: '<h2>Heading</h2><p> &nbsp; <br> </p><p> 第一<b>段</b> &amp; &#33258;&#x52d5; &lt;3 </p><p>不要摘要</p>',
      url: 'http://blog.trainerhub.cc/new', published: '2026-10-20T10:30:00+08:00' },
    { ...post, title: '重複', url: 'https://blog.trainerhub.cc/new', published: '2026-10-19' },
    { ...post, title: 'Long', url: 'https://blog.trainerhub.cc/long', content: `<p>${'字'.repeat(161)}</p>`, published: 'invalid', author: null },
    { ...post, title: 'Emoji', url: 'https://blog.trainerhub.cc/emoji', content: `<p>${'😀'.repeat(161)}</p>`, published: '', author: null },
    { ...post, url: 'https://example.test/foreign' },
    { ...post, url: 'https://blog.trainerhub.cc.evil.test/foreign' },
    { ...post, url: 'ftp://blog.trainerhub.cc/foreign' },
    { ...post, url: 'https://blog.trainerhub.cc:444/foreign' },
    { ...post, url: 'https://fake-user:fake-password@blog.trainerhub.cc/private' },
    { ...post, url: 'javascript:alert(1)' },
    { ...post, title: ' <br> &nbsp; ', url: 'https://blog.trainerhub.cc/empty' },
  ] }));
  assert.deepEqual(await (await onRequestGet({ request: Request(), env })).json(), { links: [
    { ...expectedLink, title: '視覺 & "活動" \'目標\'', summary: '第一段 & 自動 <3',
      url: 'https://blog.trainerhub.cc/new', publishedAt: '2026-10-20T02:30:00.000Z' },
    { ...expectedLink, title: 'Older', summary: 'fallback 自動', publishedAt: '2026-09-01T00:00:00.000Z', authorName: '' },
    { ...expectedLink, title: 'Long', summary: '字'.repeat(160), url: 'https://blog.trainerhub.cc/long', publishedAt: '', authorName: '' },
    { ...expectedLink, title: 'Emoji', summary: '😀'.repeat(160), url: 'https://blog.trainerhub.cc/emoji', publishedAt: '', authorName: '' },
  ] });
});

test('pagination follows tokens, stops on a repeated token and de-duplicates across pages', async (t) => {
  let page = 0;
  const { calls } = StubUpstream(t, () => Response.json([
    { items: [post], nextPageToken: 'next +/?' },
    { items: [post, { ...post, url: 'http://blog.trainerhub.cc/page2', published: '2026-10-01' }], nextPageToken: 'last' },
    { items: [], nextPageToken: 'next +/?' },
  ][page++]));
  const { links } = await (await onRequestGet({ request: Request(), env })).json();
  assert.deepEqual(calls.map(call => new URL(call.url).searchParams.get('pageToken')), [null, 'next +/?', 'last']);
  assert.deepEqual(links.map(link => link.url), ['https://blog.trainerhub.cc/page2', post.url]);
  assert.ok(calls.every(call => new Headers(call.init.headers).get('X-Goog-Api-Key') === env.BLOGGER_API_KEY));
});

test('summary truncation keeps whitespace normalised and unknown or invalid entities remain text', async (t) => {
  StubUpstream(t, () => Response.json({ items: [
    { ...post, title: '&constructor; &#x110000; &#55296;', content: `<p>${'字'.repeat(159)} 最後</p>` },
  ] }));
  const { links } = await (await onRequestGet({ request: Request(), env })).json();
  assert.equal(links[0].summary, '字'.repeat(159));
  assert.equal(links[0].title, '&constructor; &#x110000; &#55296;');
});

test('pagination reads at most four pages even with fresh continuation tokens', async (t) => {
  let page = 0;
  const { calls } = StubUpstream(t, () => Response.json({
    items: [{ ...post, url: `https://blog.trainerhub.cc/page${++page}` }], nextPageToken: `token${page}`,
  }));
  const { links } = await (await onRequestGet({ request: Request(), env })).json();
  assert.equal(calls.length, 4);
  assert.equal(links.length, 4);
});

test('empty Blogger lists are valid', async (t) => {
  StubUpstream(t, () => Response.json({}));
  assert.deepEqual(await (await onRequestGet({ request: Request(), env })).json(), { links: [] });
});

test('oversize, non-JSON, non-200, malformed and failed upstream requests return the fixed 502 body without leaking keys', async (t) => {
  const cases = [
    () => Response.json({ items: [post] }, { status: 201 }),
    () => Response.json({ error: env.BLOGGER_API_KEY }, { status: 403 }),
    () => new Response('<html>challenge</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('{}', { headers: { 'Content-Type': 'application/jsonp' } }),
    () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(maximumPageBytes + 1) } }),
    () => new Response(JSON.stringify({ items: [], padding: '字'.repeat(800_000) }), { headers: { 'Content-Type': 'application/json', 'Content-Length': '2' } }),
    () => new Response('{bad json', { headers: { 'Content-Type': 'application/json' } }),
    () => Response.json(null),
    () => Response.json({ items: 'invalid' }),
    () => { throw new TypeError(`upstream echoed ${env.BLOGGER_API_KEY}`); },
  ];
  let upstream;
  const { calls, warnings } = StubUpstream(t, () => upstream());
  for (upstream of cases) await AssertUnavailable(await onRequestGet({ request: Request(), env }));
  assert.equal(calls.length, cases.length);
  assert.equal(warnings.length, cases.length);
  assert.ok(!JSON.stringify(warnings).includes(env.BLOGGER_API_KEY));
});

test('a declared oversize page is refused before its body is read', async (t) => {
  let reads = 0;
  StubUpstream(t, () => ({
    status: 200, ok: true,
    headers: new Headers({ 'Content-Type': 'application/json', 'Content-Length': String(maximumPageBytes + 1) }),
    get body() { reads++; throw new Error('must not read'); },
  }));
  await AssertUnavailable(await onRequestGet({ request: Request(), env }));
  assert.equal(reads, 0);
});

test('a later page failure cannot expose a partial list', async (t) => {
  let page = 0;
  StubUpstream(t, () => ++page === 1
    ? Response.json({ items: [post], nextPageToken: 'second' })
    : new Response('down', { status: 503 }));
  await AssertUnavailable(await onRequestGet({ request: Request(), env }));
});

test('disallowed origins are rejected before fetching and OPTIONS keeps the shared origin policy', async (t) => {
  const { calls } = StubUpstream(t);
  const request = Request(undefined, { Origin: 'https://evil.example' });
  assert.equal((await onRequestGet({ request, env })).status, 403);
  assert.equal((await onRequestOptions({ request, env })).status, 403);
  assert.equal((await onRequestOptions({ request: Request(undefined, { Origin: 'https://trainerhub.cc' }), env })).status, 204);
  assert.equal(calls.length, 0);
});

test('the Cache API stores normalised JSON for 600 seconds under a fixed secret-free key and serves hits', async (t) => {
  const { calls } = StubUpstream(t);
  const matches = [];
  const writes = [];
  let cached;
  StubCache(t, {
    async match(key) { matches.push(key.url ?? String(key)); return cached?.clone(); },
    async put(key, response) {
      writes.push({ url: key.url ?? String(key), body: await response.clone().json(), headers: response.headers });
      cached = response.clone();
    },
  });
  const first = await onRequestGet({ request: Request('https://trainerhub.cc/api/education-feed?ignored=1'), env });
  assert.deepEqual(await first.json(), { links: [expectedLink] });
  const second = await onRequestGet({ request: Request(undefined, { Origin: 'https://trainerhub.cc' }), env });
  assert.deepEqual(await second.json(), { links: [expectedLink] });
  assert.equal(second.headers.get('Access-Control-Allow-Origin'), 'https://trainerhub.cc');
  assert.equal(second.headers.get('Cache-Control'), 'public, max-age=600');
  assert.equal(calls.length, 1);
  assert.deepEqual(matches, [cacheUrl, cacheUrl]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, cacheUrl);
  assert.deepEqual(writes[0].body, { links: [expectedLink] });
  assert.equal(writes[0].headers.get('Cache-Control'), 'public, max-age=600');
  assert.ok(!JSON.stringify(writes).includes(env.BLOGGER_API_KEY));
  assert.ok(!writes[0].headers.has('X-Goog-Api-Key'));
  await AssertUnavailable(await onRequestGet({ request: Request(), env: {} }), 503);
  assert.equal((await onRequestGet({ request: Request(undefined, { Origin: 'https://evil.example' }), env })).status, 403);
  assert.equal(matches.length, 2);
});

test('Cache API read and write failures leave the feed response usable and never log credentials', async (t) => {
  const { warnings } = StubUpstream(t);
  let puts = 0;
  StubCache(t, {
    async match() { throw new Error(env.BLOGGER_API_KEY); },
    async put() { puts++; throw new Error(env.BLOGGER_API_KEY); },
  });
  const response = await onRequestGet({ request: Request(), env });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { links: [expectedLink] });
  assert.equal(puts, 1);
  assert.ok(!JSON.stringify(warnings).includes(env.BLOGGER_API_KEY));
});
