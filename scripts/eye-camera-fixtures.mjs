import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function LoadEyeCameraFixture(root) {
  const path = resolve(root, '.tmp/eye-portrait.jpg');
  const digest = 'a6f11efaa834706db23f275b6115058fa87fc7f14362681e6abe14e82749de3e';
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  let bytes = await readFile(path).catch(() => null);
  if (!bytes || hash(bytes) !== digest) {
    const response = await fetch('https://raw.githubusercontent.com/tensorflow/tfjs-models/master/face-landmarks-detection/test_data/portrait.jpg');
    if (!response.ok) throw new Error('Eye camera fixture unavailable');
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== digest) throw new Error('Eye camera fixture digest mismatch');
    await mkdir(resolve(root, '.tmp'), { recursive: true }); await writeFile(path, bytes);
  }
  return bytes;
}
