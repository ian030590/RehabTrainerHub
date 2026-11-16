import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const repositoryRoot = resolve(import.meta.dirname, '..');
const gameRoot = resolve(repositoryRoot, 'apps/rehabtrainerhub/games/drawing-defense');

test('interrupt copy explains the session and previously sent samples in both languages', async () => {
  const source = await readFile(resolve(gameRoot, 'DrawingTowerDefenseGame.tsx'), 'utf8');
  const zh = '結束後不會保存這次紀錄；已送出的畫作樣本不受影響。';
  const en = 'Ending the activity will not save this session. Drawing samples already sent are not affected.';
  for (const text of [zh, en, `全螢幕已結束；${zh}`, `Fullscreen ended. ${en}`]) {
    assert.ok(source.includes(text), text);
  }
});

test('pause cancels unfinished drawing and freezes ticker and audio', async () => {
  const source = await readFile(resolve(gameRoot, 'DrawingTowerDefenseGame.tsx'), 'utf8');
  const syntax = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let declaration;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(syntax) === 'pause') declaration = node; ts.forEachChild(node, visit); };
  visit(syntax);
  assert.ok(declaration, 'the running game exposes a pause handler');
  const code = ts.transpileModule(`const ${declaration.getText(syntax)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [];
  const pausedRef = { current: false };
  const pause = new Function('useCallback', 'phaseRef', 'pausedRef', 'setFullscreenInterrupted', 'clearDrawingInput', 'appRef', 'DisposeAudioFeedback', 'setPaused', `${code}; return pause;`)(
    fn => fn, { current: 'playing' }, pausedRef, () => {}, () => calls.push('clear drawing'),
    { current: { ticker: { stop: () => calls.push('stop ticker') } } }, () => calls.push('stop audio'), value => calls.push(value));
  pause();
  assert.equal(pausedRef.current, true);
  assert.deepEqual(calls, ['clear drawing', 'stop ticker', 'stop audio', true]);
  pause();
  assert.equal(calls.length, 4, 'repeated pause cannot repeat cleanup or change the drawing');
});

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

test('CSS rule parsing supports Windows and macOS line endings', () => {
  for (const lineEnding of ['\r\n', '\n']) {
    const selector = ['.drawing-defense-stage,', '.drawing-defense-input'].join(lineEnding);
    const css = [
      selector,
      '{',
      '  position: absolute;',
      '  inset: 0;',
      '}',
    ].join(lineEnding);

    const rule = ReadCssRule(css, selector);
    assert.equal(rule.position, 'absolute');
    assert.equal(rule.inset, '0');
  }
});

function ReadCssRule(css, selector) {
  const normalizedCss = NormalizeLineEndings(css);
  const normalizedSelector = NormalizeLineEndings(selector);
  const escapedSelector = normalizedSelector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...normalizedCss.matchAll(new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`, 'g'))];
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

function NormalizeLineEndings(value) {
  return value.replace(/\r\n?/g, '\n');
}
