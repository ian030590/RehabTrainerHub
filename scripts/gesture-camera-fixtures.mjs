import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Google MediaPipe test images; the detector itself is never mocked.
export const handCameraFixtures = {
  pointing_up: 'ecf8ca2611d08fa25948a4fc10710af9120e88243a54da6356bacea17ff3e36e',
  fist: '43fa1cabf3f90d574accc9a56986e2ee48638ce59fc65af1846487f73bb2ef24',
  right_hands: '4b5134daa4cb60465535239535f9f74c2842aba3aa5fd30bf04ef5678f93d87f',
  victory: '84cb8853e3df614e0cb5c93a25e3e2f38ea5e4f92fd428ee7d867ed3479d5764',
  thumb_up: '5d673c081ab13b8a1812269ff57047066f9c33c07db5f4178089e8cb3fdc0291',
};

export async function LoadGestureCameraFixtures(root) {
  const directory = resolve(root, '.tmp/gesture-camera-fixture');
  await mkdir(directory, { recursive: true });
  return new Map(await Promise.all(Object.entries(handCameraFixtures).map(async ([name, digest]) => {
    const path = resolve(directory, `${name}.jpg`);
    let bytes = await readFile(path).catch(() => null);
    const hash = value => createHash('sha256').update(value).digest('hex');
    if (!bytes || hash(bytes) !== digest) {
      const response = await fetch(`https://storage.googleapis.com/mediapipe-assets/${name}.jpg`, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Camera fixture download failed: ${name}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (hash(bytes) !== digest) throw new Error(`Camera fixture digest mismatch: ${name}`);
      await writeFile(path, bytes);
    }
    return [`/__hand-test/${name}.jpg`, bytes];
  })));
}
