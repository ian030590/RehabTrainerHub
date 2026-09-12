import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '..');
const gameRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub/games/drawing-defense');

test('drawing defense keeps the pointer surface over a full-size Pixi stage', async () => {
  const css = await readFile(resolve(gameRoot, 'rules.css'), 'utf8');
  const source = await readFile(resolve(gameRoot, 'DrawingTowerDefenseGame.tsx'), 'utf8');

  const rootRule = ReadCssRule(css, '.drawing-defense');
  assert.equal(rootRule.position, 'fixed');
  assert.equal(rootRule.inset, '0');
  assert.equal(rootRule.width, '100vw');
  assert.equal(rootRule.height, '100dvh');

  const stageRule = ReadCssRule(css, '.drawing-defense-stage,\n.drawing-defense-input');
  assert.equal(stageRule.position, 'absolute');
  assert.equal(stageRule.inset, '0');
  assert.equal(stageRule.width, '100%');
  assert.equal(stageRule.height, '100%');

  const inputRule = ReadCssRule(css, '.drawing-defense-input');
  assert.equal(inputRule.zIndex, '1');
  assert.equal(inputRule.pointerEvents, 'auto');
  assert.equal(inputRule.touchAction, 'none');

  const canvasRule = ReadCssRule(css, '.drawing-defense-canvas');
  assert.equal(canvasRule.display, 'block');
  assert.equal(canvasRule.width, '100%');
  assert.equal(canvasRule.height, '100%');

  assert.match(source, /ref=\{overlayRef\}[\s\S]*className="drawing-defense-input"/);
  assert.match(source, /overlay\.addEventListener\('pointerdown'/);
  assert.match(source, /overlay\.addEventListener\('pointermove'/);
  assert.match(source, /resizeTo:\s*host/);
});

function ReadCssRule(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'g'))];
  const match = matches.at(-1);
  assert.ok(match, `Missing CSS rule for ${selector}`);

  return Object.fromEntries(
    match[1]
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(':');
        assert.ok(separator > 0, `Invalid CSS declaration: ${declaration}`);
        const property = declaration.slice(0, separator).trim().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return [property, declaration.slice(separator + 1).trim()];
      }),
  );
}
