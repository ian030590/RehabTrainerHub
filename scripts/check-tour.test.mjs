import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');

const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
const gradientSyntaxRegex = /(linear-gradient|radial-gradient|conic-gradient|gradient\()/i;
const neonKeywordsRegex = /(#00ffff|#ff00ff|#00ff00|text-shadow|0 0 \d+px)/i;

function StripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('Tour CSS contains strictly NO gradients, NO neon effects, and NO emojis', () => {
  const cssPath = resolve(repoRoot, 'packages/ui/src/tour/toutour.css');
  const rawCss = readFileSync(cssPath, 'utf8');
  const codeOnlyCss = StripCssComments(rawCss);

  assert.equal(emojiRegex.test(rawCss), false, 'toutour.css must not contain emojis');
  assert.equal(gradientSyntaxRegex.test(codeOnlyCss), false, 'toutour.css rules must not contain gradients');
  assert.equal(codeOnlyCss.includes('gradient'), false, 'toutour.css must have no gradient declarations');
  assert.equal(neonKeywordsRegex.test(codeOnlyCss), false, 'toutour.css rules must not contain neon or glow effects');
});

test('Tour engine source contains strictly NO emoji fallbacks or emojis in default labels', () => {
  const enginePath = resolve(repoRoot, 'packages/ui/src/tour/toutourEngine.ts');
  const engineContent = readFileSync(enginePath, 'utf8');

  assert.equal(emojiRegex.test(engineContent), false, 'toutourEngine.ts must not contain any emoji characters');
  assert.equal(engineContent.includes('💡'), false, 'toutourEngine.ts must not have 💡 fallback');
});

test('Hub tour step definitions and copy contain strictly NO emojis', () => {
  const hubTourPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/tour/hubTour.ts');
  const hubTourContent = readFileSync(hubTourPath, 'utf8');

  assert.equal(emojiRegex.test(hubTourContent), false, 'hubTour.ts must not contain any emoji characters');

  const zhPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/i18n/zh-TW.ts');
  const enPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/i18n/en.ts');
  const zhContent = readFileSync(zhPath, 'utf8');
  const enContent = readFileSync(enPath, 'utf8');

  // Extract the tour block from both dictionaries
  const zhTourMatch = zhContent.match(/tour:\s*\{[\s\S]*?\r?\n {4}\},/);
  const enTourMatch = enContent.match(/tour:\s*\{[\s\S]*?\r?\n {4}\},/);

  assert.ok(zhTourMatch, 'zh-TW.ts must define tour copy');
  assert.ok(enTourMatch, 'en.ts must define tour copy');

  assert.equal(emojiRegex.test(zhTourMatch[0]), false, 'zh-TW tour copy must not contain emojis');
  assert.equal(emojiRegex.test(enTourMatch[0]), false, 'en tour copy must not contain emojis');
});

test('Hub navigation guide button in globals.css contains NO gradients or neon effects', () => {
  const globalsPath = resolve(repoRoot, 'apps/rehabtrainerhub/app/globals.css');
  const globalsContent = readFileSync(globalsPath, 'utf8');

  const guideBtnMatch = globalsContent.match(/\.hub-guide-button\s*\{[\s\S]*?\}\s*@media/);
  assert.ok(guideBtnMatch, '.hub-guide-button styles must exist in globals.css');

  assert.equal(gradientSyntaxRegex.test(guideBtnMatch[0]), false, '.hub-guide-button must not contain gradients');
  assert.equal(neonKeywordsRegex.test(guideBtnMatch[0]), false, '.hub-guide-button must not contain neon or glow effects');
});
