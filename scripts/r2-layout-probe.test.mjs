import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { LayoutProbeExpression } from './r2-layout-probe.mjs';

function Rect(left, top, width, height) {
  const data = { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height };
  return { ...data, toJSON: () => data };
}

function Probe({ rect, labels = [], parent }) {
  const input = {
    localName: 'input', labels, parentElement: parent, childNodes: [],
    matches: selector => selector === 'input' || selector.startsWith('button,'),
    getBoundingClientRect: () => rect, closest: () => null, checkVisibility: () => true,
  };
  return runInNewContext(LayoutProbeExpression('mobile'), {
    innerHeight: 844, innerWidth: 390, getComputedStyle: element => element,
    document: { documentElement: { scrollWidth: 390, scrollHeight: 844 }, querySelectorAll: () => [input] },
  });
}

test('each scrollable ancestor suppresses clipping only on its scrollable axis', () => {
  const parent = { localName: 'div', overflowY: 'auto', scrollHeight: 1200, clientHeight: 800,
    overflowX: 'scroll', scrollWidth: 390, clientWidth: 390 };
  const options = { parent, rect: Rect(400, 850, 16, 16) };
  const [clipped] = Probe(options).clippedTargets;
  assert.equal(clipped.clipY, 0);
  assert.equal(clipped.clipX, 26);
  parent.scrollWidth = 450;
  assert.equal(Probe(options).clippedTargets.length, 0);
  assert.equal(Probe(options).horizontalOverflow.pixels, 0);
});

test('an input and its associated labels share an effective tap rectangle', () => {
  const options = { rect: Rect(10, 10, 16, 16), labels: [
    { getBoundingClientRect: () => Rect(0, 0, 30, 32), checkVisibility: () => true },
  ] };
  const [small] = Probe(options).smallTargets;
  assert.equal(small.rect.width, 16);
  assert.equal(small.effectiveRect.width, 30);
  assert.equal(small.effectiveRect.height, 32);
  options.labels.push({ getBoundingClientRect: () => Rect(20, 20, 24, 24), checkVisibility: () => true });
  assert.equal(Probe(options).smallTargets.length, 0);
});
