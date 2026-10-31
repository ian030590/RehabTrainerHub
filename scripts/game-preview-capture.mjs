import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

export class PreviewCaptured extends Error {}

export function CreateGameCapture({ folder, send, session, frameSession, game, preview }) {
  return async name => {
    if (preview && name !== preview.phase) return;
    if (preview) {
      assert.ok(await game(`Boolean(document.fullscreenElement || document.querySelector('[class*="-phase-playing"]'))
        && !document.querySelector('dialog[open], .game-tour, .training-confirmation, .experiment-results')`),
      'A preview must show gameplay without settings, tutorial or results.');
      await game('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      await send('Emulation.setVirtualTimePolicy', { policy: 'pause' }, frameSession || session);
    }
    const screenshot = await send('Page.captureScreenshot', { format: 'png' }, session);
    const png = Buffer.from(screenshot.data, 'base64');
    await writeFile(join(folder, `${name}.png`), png);
    if (!preview) return;
    const metadata = await sharp(png).metadata();
    assert.ok(Math.abs(metadata.width / metadata.height - 16 / 9) < 0.01, 'Capture the whole game in a 16:9 viewport.');
    const image = await sharp(png).resize(640, 360).webp({ quality: 90 }).toBuffer();
    await writeFile(preview.output, image);
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(folder, 'preview.json'), JSON.stringify({
      gameId: preview.gameId, version: preview.version, phase: name,
      screenshotWidth: metadata.width, screenshotHeight: metadata.height,
      screenshotSha256: hash(png), previewSha256: hash(image),
    }, null, 2) + '\n');
    throw new PreviewCaptured(`${preview.gameId}: captured actual ${name} to ${preview.output}`);
  };
}
