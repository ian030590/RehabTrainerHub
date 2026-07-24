import assert from 'node:assert/strict';
import {
  CreateSignedValue,
  authCookieName,
} from '../../_lib/auth.js';
import { onRequestPost as uploadAsset } from './assets.js';

const secret = '0123456789abcdef0123456789abcdef';
const staff = {
  id: 'therapist-1',
  display_name: 'Therapist',
  email: 'therapist@example.test',
  role: 'therapist',
};
let uploaded = null;
let auditWrites = 0;
const env = {
  AUTH_SESSION_SECRET: secret,
  ASSET_PUBLIC_BASE_URL: 'https://assets.trainerhub.cc/',
  ASSET_BUCKET: {
    async put(key, bytes, options) {
      uploaded = { key, bytes, options };
    },
  },
  REHAB_DB: {
    prepare(sql) {
      return {
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
        bind(...args) {
          return {
            async first() {
              return /FROM app_users\s+WHERE id = \?/i.test(sql) && args[0] === staff.id
                ? staff
                : null;
            },
            async run() {
              if (/INSERT INTO admin_audit_events/i.test(sql)) auditWrites += 1;
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  },
};
const token = await CreateSignedValue({ sub: staff.id }, secret, 60);
const cookie = `${authCookieName}=${encodeURIComponent(token)}`;

const unsafeBaseUrlResponse = await uploadAsset({
  request: new Request('https://trainerhub.cc/api/admin/assets', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: cookie,
      'Content-Type': 'multipart/form-data; boundary=test',
      'Content-Length': '128',
    },
    body: '--test--',
  }),
  env: {
    ...env,
    ASSET_PUBLIC_BASE_URL: 'javascript://localhost/unsafe',
  },
});
assert.equal(unsafeBaseUrlResponse.status, 503);

const oversizedResponse = await uploadAsset({
  request: new Request('https://trainerhub.cc/api/admin/assets', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: cookie,
      'Content-Type': 'multipart/form-data; boundary=test',
      'Content-Length': String(5 * 1024 * 1024 + 64 * 1024 + 1),
    },
    body: '--test--',
  }),
  env,
});
assert.equal(oversizedResponse.status, 413);
assert.equal(uploaded, null);

const formData = new FormData();
formData.set('file', new Blob([
  Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
], { type: 'image/png' }), 'cover.png');
const uploadResponse = await uploadAsset({
  request: new Request('https://trainerhub.cc/api/admin/assets', {
    method: 'POST',
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: cookie,
      'Content-Length': '1024',
    },
    body: formData,
  }),
  env,
});
assert.equal(uploadResponse.status, 201);
const payload = await uploadResponse.json();
assert.match(payload.url, /^https:\/\/assets\.trainerhub\.cc\/articles\//);
assert.equal(payload.key, uploaded.key);
assert.equal(uploaded.options.httpMetadata.contentType, 'image/png');
assert.equal(
  uploaded.options.httpMetadata.cacheControl,
  'public, max-age=31536000, immutable',
);
assert.equal(auditWrites, 1);

console.log('admin asset security checks passed');
