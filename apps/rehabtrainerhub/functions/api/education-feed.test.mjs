import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet } from './education-feed.js';

const feedUrl = 'https://ian.trainerhub.cc/rss.xml';
const feedXml = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item><title>A</title></item></channel></rss>';
const env = { ALLOWED_ORIGINS: 'https://trainerhub.cc' };

function Request(url = 'https://trainerhub.cc/api/education-feed', headers = {}) {
  return new globalThis.Request(url, { headers });
}

async function WithFetch(fake, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input instanceof globalThis.Request ? input.url : input), init });
    return fake(input, init);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}

test('the Hub reads the personal-site feed on the server so the browser needs no cross-site request', async () => {
  await WithFetch(async () => new Response(feedXml, { headers: { 'Content-Type': 'application/xml' } }), async (calls) => {
    const response = await onRequestGet({ request: Request(), env });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { xml: feedXml });
    assert.match(response.headers.get('Content-Type'), /^application\/json/);
    assert.match(response.headers.get('Cache-Control'), /max-age=\d+/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, feedUrl);
  });
});

test('query parameters cannot point the feed proxy at another address', async () => {
  await WithFetch(async () => new Response(feedXml, { headers: { 'Content-Type': 'application/rss+xml' } }), async (calls) => {
    const response = await onRequestGet({
      request: Request('https://trainerhub.cc/api/education-feed?url=https://example.test/x.xml&feed=http://127.0.0.1/'),
      env,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(calls.map(call => call.url), [feedUrl]);
  });
});

test('an upstream block, an HTML challenge page, an oversized body or a network failure never reach the page', async () => {
  const cases = [
    async () => new Response('blocked', { status: 403, headers: { 'Content-Type': 'text/html' } }),
    async () => new Response('<html>challenge</html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    async () => new Response(`<rss>${'x'.repeat(1024 * 1024 + 1)}</rss>`, { headers: { 'Content-Type': 'application/xml' } }),
    async () => new Response('not a feed', { headers: { 'Content-Type': 'application/xml' } }),
    async () => { throw new TypeError('network down'); },
  ];
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const upstream of cases) {
      await WithFetch(upstream, async () => {
        const response = await onRequestGet({ request: Request(), env });
        assert.equal(response.status, 502);
        const body = await response.json();
        assert.deepEqual(Object.keys(body), ['error']);
        assert.doesNotMatch(JSON.stringify(body), /blocked|challenge|network down|not a feed/);
      });
    }
  } finally {
    console.warn = warn;
  }
});

test('requests from origins the Hub does not serve are refused before any upstream fetch', async () => {
  await WithFetch(async () => new Response(feedXml, { headers: { 'Content-Type': 'application/xml' } }), async (calls) => {
    const response = await onRequestGet({
      request: Request('https://trainerhub.cc/api/education-feed', { Origin: 'https://evil.example' }),
      env,
    });
    assert.equal(response.status, 403);
    assert.equal(calls.length, 0);
  });
});
