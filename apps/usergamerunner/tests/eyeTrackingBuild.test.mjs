import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../../..');
const fixtureParent = resolve(root, '.tmp/eye-model-build-fix');
const require = createRequire(import.meta.url);
const vendor = await readFile(resolve(root, 'apps/usergamerunner/runtime/WEBGAZER-SOURCE.txt'));
const source = await readFile(resolve(root, 'apps/usergamerunner/scripts/buildEyeTracking.mjs'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const pinnedAssets = [
  ['facemesh/model.json', 93029, 'c922985d95e101e7fe56576a9a00366c72d3fab3604ce371cc9d85394abda99c'],
  ['facemesh/group1-shard1of1.bin', 2955780, 'f4a7075c1fff12ceafd2cd6fc000a464da90b1e0c35236971ed5bb3b343366cb'],
  ['blazeface/model.json', 64036, '7b6bb6f35e5a7899232de51dda8bf514ef9664ca7ec58388c9fecc088c883b58'],
  ['blazeface/group1-shard1of1.bin', 401768, '60b481ab6c19352673cdb21e02e639f90883db1393ac52d07c7ea4e1e11cb2cd'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function Fixture(context, { seedCache = false } = {}) {
  await mkdir(fixtureParent, { recursive: true });
  const directory = await mkdtemp(resolve(fixtureParent, 'build-'));
  context.after(async () => {
    assert.ok(directory.startsWith(fixtureParent + sep), 'Only delete the generated fixture directory.');
    await rm(directory, { recursive: true, force: true });
  });
  const appRoot = resolve(directory, 'apps/usergamerunner');
  const output = resolve(directory, 'output');
  await mkdir(resolve(appRoot, 'runtime'), { recursive: true });
  await mkdir(resolve(directory, 'scripts'), { recursive: true });
  await writeFile(resolve(appRoot, 'runtime/WEBGAZER-SOURCE.txt'), vendor);
  await writeFile(resolve(appRoot, 'runtime/eyeTrackingController.js'), 'export const controller = true;');
  await writeFile(resolve(appRoot, 'runtime/eyeTrackingEntry.js'), 'const config = {\n  timeOrigin: performance.timeOrigin,\n  now: () => performance.now(),\n};');
  const bytes = new Map();
  const manifest = { version: 'eye-tracking-1.0.0', vendorSha256: hash(vendor), assets: pinnedAssets.map(([path]) => {
    const content = Buffer.from('pinned fixture: ' + path);
    bytes.set(path, content);
    return { path, source: 'apps/usergamerunner/runtime/eye-tracking-model/' + path,
      sourceUrl: 'https://tfhub.example/' + path, size: content.length, sha256: hash(content) };
  }) };
  for (const asset of manifest.assets) {
    const path = resolve(directory, asset.source);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes.get(asset.path));
    if (seedCache) {
      const cached = resolve(directory, '.tmp/eye-tracking-model', asset.path);
      await mkdir(dirname(cached), { recursive: true });
      await writeFile(cached, bytes.get(asset.path));
    }
  }
  const manifestPath = resolve(directory, 'scripts/eye-tracking-assets.manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  const downloads = [], bundles = [];
  const loaded = {};
  new Function('exports', 'require', 'fetch', compiled)(loaded,
    name => name === 'vite' ? { build: async options => bundles.push(options) } : require(name),
    async url => { downloads.push(url); return new Response('Forbidden', { status: 403 }); });
  return { directory, appRoot, output, bytes, manifest, manifestPath, downloads, bundles,
    build: () => loaded.BuildEyeTracking(appRoot, output) };
}

test('a clean checkout builds both eye input versions when the upstream returns 403', async context => {
  const fixture = await Fixture(context);
  await fixture.build();
  assert.deepEqual(fixture.downloads, [], 'Pinned eye assets must not depend on a live upstream download.');
  assert.equal(fixture.bundles.length, 1, 'The build reaches the client bundle step.');
  for (const version of ['1.0.0', '1.1.0']) {
    for (const asset of fixture.manifest.assets) {
      assert.deepEqual(await readFile(resolve(fixture.output, `input/eye-tracking-${version}/models`, asset.path)), fixture.bytes.get(asset.path));
    }
  }
});

test('an invalid old cache cannot replace the pinned bundled eye model', async context => {
  const fixture = await Fixture(context, { seedCache: true });
  const cached = resolve(fixture.directory, '.tmp/eye-tracking-model', fixture.manifest.assets[0].path);
  await writeFile(cached, Buffer.from('untrusted cache'));
  await fixture.build();
  assert.deepEqual(fixture.downloads, []);
  assert.deepEqual(await readFile(resolve(fixture.output, 'input/eye-tracking-1.1.0/models', fixture.manifest.assets[0].path)), fixture.bytes.get(fixture.manifest.assets[0].path));
});

test('same-size bundle corruption fails closed even with a valid warm cache', async context => {
  const fixture = await Fixture(context, { seedCache: true });
  const asset = fixture.manifest.assets[0];
  const corrupted = Buffer.from(fixture.bytes.get(asset.path));
  corrupted[0] ^= 1;
  await writeFile(resolve(fixture.directory, asset.source), corrupted);
  await assert.rejects(fixture.build(), /digest mismatch/i);
  assert.deepEqual(fixture.downloads, []);
  assert.equal(fixture.bundles.length, 0, 'Do not bundle a runtime after an unverified model.');
});

test('a bundled eye model with the expected digest but wrong declared size fails closed', async context => {
  const fixture = await Fixture(context, { seedCache: true });
  fixture.manifest.assets[0].size++;
  await writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest));
  await assert.rejects(fixture.build(), /digest mismatch/i);
  assert.deepEqual(fixture.downloads, []);
  assert.equal(fixture.bundles.length, 0);
});

test('a missing bundled model cannot silently use an old cache or upstream response', async context => {
  const fixture = await Fixture(context, { seedCache: true });
  await rm(resolve(fixture.directory, fixture.manifest.assets[0].source));
  await assert.rejects(fixture.build(), /ENOENT/);
  assert.deepEqual(fixture.downloads, []);
  assert.equal(fixture.bundles.length, 0);
});

test('committed eye assets retain the exact approved model bytes and upstream provenance', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'scripts/eye-tracking-assets.manifest.json'), 'utf8'));
  assert.deepEqual(manifest.assets.map(asset => [asset.path, asset.size, asset.sha256]), pinnedAssets);
  for (const asset of manifest.assets) {
    assert.equal(asset.source, 'apps/usergamerunner/runtime/eye-tracking-model/' + asset.path);
    assert.match(asset.sourceUrl, /^https:\/\/tfhub\.dev\//);
    const bytes = await readFile(resolve(root, asset.source));
    assert.equal(bytes.length, asset.size, asset.path);
    assert.equal(hash(bytes), asset.sha256, asset.path);
  }
  const attributes = execFileSync('git', ['check-attr', '-z', 'text', '--', ...manifest.assets.map(asset => asset.source)],
    { cwd: root, encoding: 'utf8' }).split('\0');
  for (let index = 0; index < attributes.length - 1; index += 3) {
    assert.equal(attributes[index + 2], 'unset', `${attributes[index]} must not change newlines on checkout.`);
  }
});
