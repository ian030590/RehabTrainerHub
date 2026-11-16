import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const chromeContractGames = ['flanker', 'stroop', 'simon-task', 'go-nogo', 'sart', 'stop-signal', 'antisaccade', 'attention-network-task', 'attentional-blink', 'continuous-performance', 'divided-attention', 'reaction-time', 'schulte-grid', 'digit-span', 'keep-track', 'letter-memory', 'n-back', 'spatial-span', 'pattern-memory', 'memory-match', 'simon-says', 'hex-schulte', 'whack-a-mole', 'ufov', 'every-ball-response', 'connect4', 'dots-and-boxes', 'hex', 'lights-out', 'maze', 'minesweeper', 'card-sorting', 'number-letter', 'plus-minus', 'sliding-puzzle', 'sudoku', 'tic-tac-toe', 'time-perception', 'tower-of-london', 'complex-search', 'conjunction-search', 'popout-search', 'exploratory-saccade', 'gabor-patching', 'moving-card', 'reading-training', 'driving-rehab', 'hart-chart'];
const componentOverrides = { 'hart-chart': 'HartChartPage', 'tower-of-london': 'TowerPlanning', 'go-nogo': 'GoNoGoGame', 'attention-network-task': 'AttentionNetworkGame', 'reaction-time': 'ReactionSignal', 'digit-span': 'DigitSpanRecall', 'keep-track': 'KeepTrackRecall', 'letter-memory': 'LetterMemoryRecall', 'n-back': 'NBackLetters', 'spatial-span': 'SpatialSpanRecall', 'whack-a-mole': 'WhackAMoleGame', 'every-ball-response': 'EveryBallGame', 'number-letter': 'NumberLetterSwitch', 'plus-minus': 'PlusMinusSwitch' };
const read = path => readFileSync(path, 'utf8');
const catalog = read('apps/rehabtrainerhub/games/catalog.ts');

function ThemeForCategory(category) {
  const theme = catalog.match(new RegExp(`(?:'${category}'|\\b${category}):\\s*\\{[\\s\\S]*?colors: \\{ primary: '([^']+)', dark: '([^']+)'(?:, surfaceMixRatio: (\\d+))?`));
  return theme && { primary: theme[1], hover: theme[2], surfaceMixRatio: theme[3] ?? '8' };
}

function EscapeBranches(source) {
  const file = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const branches = [];
  function Visit(node) {
    if (ts.isIfStatement(node) && /\.key\s*===\s*['"]Escape['"]/.test(node.expression.getText(file))) branches.push(node.thenStatement);
    ts.forEachChild(node, Visit);
  }
  Visit(file);
  return branches.map(branch => branch.getText(file));
}

test('category lookup defaults an omitted surface mix ratio to eight percent', () => {
  assert.deepEqual(ThemeForCategory('vision'), { primary: '#006c47', hover: '#005235', surfaceMixRatio: '8' });
  assert.deepEqual(ThemeForCategory('attention'), { primary: '#7a4a24', hover: '#5a3519', surfaceMixRatio: '10' });
});

test('Escape branch lookup includes multiline handlers with arbitrary names', () => {
  const branches = EscapeBranches(`const keyboard = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      exit();
    }
  };`);
  assert.equal(branches.length, 1);
  assert.match(branches[0], /exit\(\)/);
});

for (const game of chromeContractGames) {
  const root = `apps/rehabtrainerhub/games/${game}`;
  const manifest = JSON.parse(read(`${root}/public/game.json`));
  const theme = ThemeForCategory(manifest.category);
  const css = ['game.css', 'rules.css', 'results.css'].map(file => read(`${root}/${file}`));
  const componentName = componentOverrides[game] ?? `${game.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('')}Game`;
  const component = read(`${root}/${componentName}.tsx`);
  const analysis = read(`${root}/ScoreAnalysis.tsx`);

  test(`${game}: category theme and chrome CSS`, () => {
    assert.ok(theme, 'category theme exists');
    assert.match(css[0], new RegExp(`--primary:\\s*${theme.primary}`));
    assert.match(css[0], new RegExp(`--primary-hover:\\s*${theme.hover}`));
    assert.match(css[0], new RegExp(`--primary-soft:\\s*color-mix\\(in srgb, var\\(--primary\\) ${theme.surfaceMixRatio}%, #fff\\)`));
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
    assert.match(component, /<button\b(?=[^>]*ref=\{stopRef\})(?=[^>]*onClick=\{[^}]+\})[^>]*>\{en \? 'Stop' : '停止'\}/);
    assert.match(component, /game-interrupt-panel[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
    for (const text of ['已暫停', 'Paused', '繼續', 'Continue', '結束活動', 'End activity']) assert.ok(component.includes(text), text);
    const escapeBranches = EscapeBranches(component);
    assert.ok(escapeBranches.length, 'Escape handler exists');
    for (const branch of escapeBranches) assert.doesNotMatch(branch, /\bexit\s*\(/);
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
