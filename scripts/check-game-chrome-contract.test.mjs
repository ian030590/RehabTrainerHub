import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const chromeContractGames = ['flanker'];
const read = path => readFileSync(path, 'utf8');
const catalog = read('apps/rehabtrainerhub/games/catalog.ts');

for (const game of chromeContractGames) {
  const root = `apps/rehabtrainerhub/games/${game}`;
  const manifest = JSON.parse(read(`${root}/public/game.json`));
  const theme = catalog.match(new RegExp(`(?:'${manifest.category}'|\\b${manifest.category}):\\s*\\{[\\s\\S]*?colors: \\{ primary: '([^']+)', dark: '([^']+)', surfaceMixRatio: (\\d+)`));
  const css = ['game.css', 'rules.css', 'results.css'].map(file => read(`${root}/${file}`));
  const component = read(`${root}/${game === 'flanker' ? 'FlankerGame' : game}.tsx`);
  const analysis = read(`${root}/ScoreAnalysis.tsx`);

  test(`${game}: category theme and chrome CSS`, () => {
    assert.ok(theme, 'category theme exists');
    assert.match(css[0], new RegExp(`--primary:\\s*${theme[1]}`));
    assert.match(css[0], new RegExp(`--primary-hover:\\s*${theme[2]}`));
    assert.match(css[0], new RegExp(`--primary-soft:\\s*color-mix\\(in srgb, var\\(--primary\\) ${theme[3]}%, #fff\\)`));
    assert.doesNotMatch(css.slice(1).join('\n'), /#[0-9a-f]{3,8}\b|var\(--(?:primary|background|surface|text|heading|text-muted|border|border-strong|text-on-accent|bg-overlay|error|radius),/i);
    assert.doesNotMatch(css[1], /(?:row|column)-reverse/);
  });
  test(`${game}: results heading has an appropriate focus indicator`, () => {
    assert.match(css[2], /\.experiment-results h1:focus-visible\s*\{\s*outline:\s*3px solid var\(--primary\);\s*outline-offset:\s*3px;\s*\}\s*\.experiment-results h1:focus:not\(:focus-visible\)\s*\{\s*outline:\s*none;\s*\}/);
  });
  test(`${game}: settings controls use the category accent`, () => {
    assert.match(css.join('\n'), /\.training-config input\[type=range\]\s*,\s*\.training-config input\[type=checkbox\]\s*,\s*\.training-config input\[type=radio\]\s*\{\s*accent-color:\s*var\(--primary\);\s*\}/);
  });
  test(`${game}: settings and interrupt controls`, () => {
    const nav = component.split('training-config-navigation-buttons')[1].split('</footer>')[0];
    assert.ok(nav.indexOf('btn-ghost') < nav.indexOf('btn-primary'));
    assert.match(component, /flanker-stop[^>]*onClick=\{[^}]+\}[^>]*>\{en \? 'Stop' : '停止'\}/);
    assert.match(component, /game-interrupt-panel[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
    for (const text of ['已暫停', 'Paused', '繼續', 'Continue', '結束活動', 'End activity']) assert.ok(component.includes(text), text);
    const keys = component.split('const keys =')[1].split('const pagehide')[0];
    assert.doesNotMatch(keys, /Escape[^\n]*exit\(/);
    assert.match(component, /stopRef\.current\?\.focus\(\)/, 'Continue restores focus to Stop');
    assert.match(component, /onSubmit=\{event => \{ event\.preventDefault\(\); confirmSettings\(\); \}\}/);
    assert.match(nav, /className="btn btn-primary" type="button" onClick=\{confirmSettings\}/);
    assert.match(component, /onKeyDown=\{event => \{ if \(event\.key === 'Enter'[^\n]*confirmSettings\(\)/);
  });
  test(`${game}: result hierarchy and accessible chart`, () => {
    const result = component.split('className="experiment-results"')[1];
    for (const text of ['Session results', '當次成果', 'score-complete', 'score-save-status', 'score-actions', 'score-details', '查看詳細資料', 'View details']) assert.ok(result.includes(text), text);
    const positions = ['score-header', 'score-priority', 'score-save-status', 'score-actions', 'score-details', 'score-context', '<ScoreAnalysis'].map(text => result.indexOf(text));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.match(result, /role="status"/);
    assert.match(result, /<details className="score-details">/);
    assert.match(analysis, /<svg[^>]*tabIndex=\{0\}/);
    assert.doesNotMatch(analysis, /<circle[^>]*tabIndex/);
    assert.match(analysis, /ArrowLeft/);
    assert.match(analysis, /ArrowRight/);
    assert.match(analysis, /aria-live="polite"/);
  });
}
