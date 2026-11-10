import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const css = readFileSync(resolve(root, 'apps/rehabtrainerhub/app/globals.css'), 'utf8');

test('the Hub can render its existing navigation and search symbols without Google Fonts', () => {
  const fontFace = [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)]
    .find(([, declarations]) => declarations.includes('Material Symbols Outlined'))?.[1];
  assert.ok(fontFace, 'Critical icons need a bundled font face when external font services are blocked.');
  const path = fontFace.match(/url\(['"]?(\/fonts\/[^)'"\s]+)/)?.[1];
  assert.ok(path, 'Icon font must be served by this site.');
  const file = resolve(root, 'apps/rehabtrainerhub/public', path.slice(1));
  assert.ok(existsSync(file), 'The font URL must resolve to a shipped file.');
  const bytes = readFileSync(file);
  assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
  assert.ok(bytes.length < 100_000, 'Only the Hub icon subset belongs in the initial UI.');
  const layout = readFileSync(resolve(root, 'apps/rehabtrainerhub/app/layout.tsx'), 'utf8');
  assert.doesNotMatch(layout, /https:\/\/fonts\.googleapis\.com[^"\n]*Material\+Symbols/,
    'The same icon face must not race an external stylesheet.');
});

test('OKLCH semantic colors keep neutral readable text and contrasting controls', () => {
  const modern = css.match(/@supports\s*\(color:\s*oklch\([^)]*\)\)\s*\{\s*:root\s*\{([^}]+)\}/)?.[1];
  assert.ok(modern, 'Supported browsers should use an OKLCH semantic palette with existing fallbacks.');
  const tokens = Object.fromEntries([...modern.matchAll(/--([\w-]+):\s*oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\);/g)]
    .map(([, name, lightness, chroma, hue]) => [name, ToSrgb(Number(lightness) > 1 ? Number(lightness) / 100 : Number(lightness), Number(chroma), Number(hue))]));
  for (const name of ['text', 'text-muted', 'heading', 'primary', 'primary-hover']) {
    assert.ok(tokens[name], `Missing OKLCH ${name}`);
    assert.ok(Math.max(...tokens[name]) - Math.min(...tokens[name]) < .003, `${name} stays neutral`);
    assert.ok(Contrast(tokens[name], tokens.surface) >= 4.5, `${name} stays readable on a content surface`);
  }
  for (const name of ['border-strong', 'focus']) {
    assert.ok(Contrast(tokens[name], tokens.surface) >= 3, `${name} remains discernible`);
  }
  for (const name of ['error', 'success']) {
    assert.ok(Contrast(tokens[name], tokens.surface) >= 4.5, `${name} supports ordinary text`);
  }
});

test('standalone guide and prompt-copy buttons offer at least a 44px touch height', () => {
  for (const selector of ['.hub-guide-button', '.developer-prompt-output button']) {
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selectors]) => selectors.split(',').some(value => value.trim() === selector))
      .map(([, , declarations]) => declarations).join('\n');
    assert.match(rule, /(?:min-height|height):\s*(?:4[4-9]|[5-9]\d)px;/, selector);
    assert.doesNotMatch(rule, /(?:^|;)\s*(?:min-height|height):\s*(?:[0-3]?\d|4[0-3])px;/, selector);
  }
  const authCss = readFileSync(resolve(root, 'packages/ui/src/components/AuthPanel.css'), 'utf8');
  for (const selector of ['.auth-button', '.auth-link-button']) {
    const declarations = authCss.match(new RegExp(selector.replaceAll('.', '\\.') + '\\s*\\{([^}]+)\\}'))?.[1] || '';
    assert.match(declarations, /min-height:\s*44px;/, `${selector} is a standalone touch action`);
  }
});

test('Chinese developer headings use readable multi-line leading and moderate tracking', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.trim() === '.developer-hero h1:lang(zh)')
    .map(([, , declarations]) => declarations).join('\n');
  assert.ok(rules, 'Chinese headings need their own metrics instead of compressed Latin display type.');
  assert.match(rules, /line-height:\s*1\.(?:[2-9]\d*|1[5-9]\d*);/);
  assert.match(rules, /letter-spacing:\s*(?:0|-(?:0\.)?0(?:0\d*|1[0-5]?))em;/);
});

function ToSrgb(lightness, chroma, hue) {
  const a = chroma * Math.cos(hue * Math.PI / 180);
  const b = chroma * Math.sin(hue * Math.PI / 180);
  const l = (lightness + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (lightness - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (lightness - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}

function Contrast(first, second) {
  const luminance = color => color[0] * .2126 + color[1] * .7152 + color[2] * .0722;
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
