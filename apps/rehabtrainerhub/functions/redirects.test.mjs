import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest, retiredTrainerHosts } from './_middleware.js';

for (const hostname of retiredTrainerHosts) {
  test(`${hostname} redirects every path to the Hub`, async () => {
    let continued = false;
    const response = await onRequest({
      request: new Request(`https://${hostname}/old/path?source=legacy`),
      next() {
        continued = true;
        return new Response('next');
      },
    });
    assert.equal(continued, false);
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://trainerhub.cc/');
  });
}

test('the canonical Hub request continues unchanged', async () => {
  const response = await onRequest({
    request: new Request('https://trainerhub.cc/qa/'),
    next: () => new Response('next', { status: 200 }),
  });
  assert.equal(response.status, 200);
});
