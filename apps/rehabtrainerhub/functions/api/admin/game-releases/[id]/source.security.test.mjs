import assert from 'node:assert/strict';
import test from 'node:test';
import { CreateSignedValue, authCookieName } from '../../../../_lib/auth.js';
import { onRequestGet } from './source.js';

const secret = '0123456789abcdef0123456789abcdef';
const admin = {
  id: 'admin-source-1',
  display_name: 'Reviewer',
  email: 'reviewer@example.test',
  role: 'admin',
};
const source = '<script>alert(1)</script>\n';
const sourceBytes = new TextEncoder().encode(source);
const sourceHash = await Sha256Hex(sourceBytes);
const token = await CreateSignedValue({ sub: admin.id }, secret, 60);

test('source viewer requires admin auth and rejects unsafe paths', async () => {
  const unauthenticated = await onRequestGet({
    request: new Request('https://trainerhub.cc/api/admin/game-releases/release-1/source?path=index.html'),
    env: CreateEnv(),
    params: { id: 'release-1' },
  });
  assert.equal(unauthenticated.status, 401);

  const unsafe = await onRequestGet({
    request: AuthorizedRequest('https://trainerhub.cc/api/admin/game-releases/release-1/source?path=../secret.js'),
    env: CreateEnv(),
    params: { id: 'release-1' },
  });
  assert.equal(unsafe.status, 400);
});

test('source viewer returns verified text/plain and never executable HTML', async () => {
  const response = await onRequestGet({
    request: AuthorizedRequest('https://trainerhub.cc/api/admin/game-releases/release-1/source?path=index.html'),
    env: CreateEnv(),
    params: { id: 'release-1' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Security-Policy') || '', /default-src 'none'/);
  assert.equal(await response.text(), source);
});

test('source viewer fails closed when a quarantined file changes', async () => {
  const response = await onRequestGet({
    request: AuthorizedRequest('https://trainerhub.cc/api/admin/game-releases/release-1/source?path=index.html'),
    env: CreateEnv({ bytes: new TextEncoder().encode('x'.repeat(sourceBytes.byteLength)) }),
    params: { id: 'release-1' },
  });
  assert.equal(response.status, 409);
});

function AuthorizedRequest(url) {
  return new Request(url, {
    headers: {
      Origin: 'https://trainerhub.cc',
      Cookie: `${authCookieName}=${encodeURIComponent(token)}`,
    },
  });
}

function CreateEnv({ bytes = sourceBytes, contentType = 'text/html' } = {}) {
  return {
    AUTH_SESSION_SECRET: secret,
    REHAB_DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (/SELECT id, display_name, email, avatar_url, role\s+FROM app_users/i.test(sql)) {
                  return args[0] === admin.id ? admin : null;
                }
                if (/FROM game_release_files/i.test(sql)) {
                  return {
                    path: 'index.html',
                    content_type: contentType,
                    byte_size: sourceBytes.byteLength,
                    sha256: sourceHash,
                    quarantine_key: 'quarantine/admin-source-1/release-1/' + 'a'.repeat(64) + '/files/index.html',
                  };
                }
                return null;
              },
            };
          },
        };
      },
    },
    GAME_QUARANTINE_BUCKET: {
      async get() {
        return { size: bytes.byteLength, async arrayBuffer() { return bytes.buffer; } };
      },
    },
  };
}

async function Sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
