import assert from 'node:assert/strict';
import test from 'node:test';
import {
  onRequestGet,
  onRequestHead,
  onRequestOptions,
  ParseRuntimeAssetKey,
} from './runtime-assets/[[path]].js';

const assetPath = '/runtime-assets/ai/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const assetBytes = new TextEncoder().encode('model-bytes');

test('runtime asset route only accepts allowlisted immutable asset keys', () => {
  assert.equal(ParseRuntimeAssetKey(assetPath), 'ai/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
  assert.equal(ParseRuntimeAssetKey('/runtime-assets/ai/secret/../../token'), null);
  assert.equal(ParseRuntimeAssetKey('/runtime-assets/ai/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/%2e%2e/task'), null);
  assert.equal(ParseRuntimeAssetKey('/runtime-assets/articles/cover.png'), null);
  assert.equal(ParseRuntimeAssetKey('/runtime-assets/ai/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task%2Fother'), null);
});

test('GET serves a runtime asset with immutable and browser isolation headers', async () => {
  const requestedKeys = [];
  const response = await onRequestGet({
    request: new Request(`https://trainerhub.cc${assetPath}`, {
      headers: { Origin: 'https://trainerhub.cc' },
    }),
    env: {
      ASSET_BUCKET: {
        async get(key) {
          requestedKeys.push(key);
          return {
            body: assetBytes,
            size: assetBytes.byteLength,
            httpEtag: '"asset-etag"',
            httpMetadata: { contentType: 'application/octet-stream' },
          };
        },
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requestedKeys, [ParseRuntimeAssetKey(assetPath)]);
  assert.equal(await response.text(), 'model-bytes');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(response.headers.get('etag'), '"asset-etag"');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://trainerhub.cc');
});

test('HEAD uses bucket metadata and conditional requests without exposing a body', async () => {
  let headCalls = 0;
  let getCalls = 0;
  const context = {
    request: new Request(`https://trainerhub.cc${assetPath}`, {
      method: 'HEAD',
      headers: { Origin: 'https://trainerhub.cc' },
    }),
    env: {
      ASSET_CORS_ORIGINS: 'https://evil.example',
      ASSET_BUCKET: {
        async head() {
          headCalls += 1;
          return {
            size: assetBytes.byteLength,
            etag: 'asset-etag',
            httpMetadata: { contentType: 'application/octet-stream' },
          };
        },
        async get() {
          getCalls += 1;
          return null;
        },
      },
    },
  };
  const response = await onRequestHead(context);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  assert.equal(headCalls, 1);
  assert.equal(getCalls, 0);
  assert.equal(response.headers.get('content-length'), String(assetBytes.byteLength));

  const notModified = await onRequestHead({
    ...context,
    request: new Request(`https://trainerhub.cc${assetPath}`, {
      method: 'HEAD',
      headers: {
        Origin: 'https://trainerhub.cc',
        'If-None-Match': '"asset-etag"',
      },
    }),
  });
  assert.equal(notModified.status, 304);
});

test('unknown origins cannot use the asset route as a public proxy', async () => {
  const response = await onRequestGet({
    request: new Request(`https://trainerhub.cc${assetPath}`, {
      headers: { Origin: 'https://evil.example' },
    }),
    env: {
      ASSET_BUCKET: {
        async get() {
          throw new Error('bucket must not be read for an untrusted origin');
        },
      },
    },
  });
  assert.equal(response.status, 403);

  const options = onRequestOptions({
    request: new Request('https://trainerhub.cc/runtime-assets/ai/mediapipe-models', {
      method: 'OPTIONS',
      headers: { Origin: 'https://trainerhub.cc' },
    }),
    env: {},
  });
  assert.equal(options.status, 204);
  assert.match(options.headers.get('access-control-allow-methods'), /GET/);
});
