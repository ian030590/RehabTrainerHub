import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const gamesRoot = resolve(root, 'apps/rehabtrainerhub/games');
const read = path => readFileSync(resolve(root, path), 'utf8');
const emDash = String.fromCharCode(0x2014);
const ignoredDirectories = new Set(['.git', '.next', '.tmp', '.turbo', '.wrangler', 'coverage', 'dist', 'node_modules', 'out']);
// Third-party sources keep their original bytes; reference digests pin them.
const vendoredPaths = [/\/public\/runtime\//, /\/public\/reference\//, /WEBGAZER-SOURCE\.txt$/, /\.min\.js$/];
const r2Games = ['asteroid-shield', 'drawing-defense', 'driving-rehab', 'gabor-patching', 'gesture-battler',
  'hart-chart', 'motor-cortex-rehab', 'moving-card', 'oculomotor-training', 'reading-training', 'sart', 'schulte-grid', 'hex-schulte', 'continuous-performance', 'simon-task', 'card-sorting', 'attentional-blink', 'time-perception', 'divided-attention', 'pattern-memory', 'stroop', 'flanker', 'go-nogo', 'stop-signal', 'attention-network-task', 'n-back', 'number-letter', 'digit-span', 'spatial-span', 'tower-of-london', 'reaction-time', 'tic-tac-toe', 'connect4', 'hex', 'dots-and-boxes', 'lights-out', 'sliding-puzzle', 'maze', 'sudoku', 'memory-match', 'simon-says', 'whack-a-mole', 'minesweeper', 'antisaccade', 'keep-track', 'letter-memory', 'plus-minus'];

function* SourceFiles(directory) {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) yield* SourceFiles(path);
    else if (/\.(tsx?|mjs|js|cjs|css|json|html|txt)$/.test(entry)) yield relative(root, path).replaceAll('\\', '/');
  }
}

function Luminance(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map(c => c + c).join('') : value;
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function Contrast(a, b) {
  const [high, low] = [Luminance(a), Luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function CssRules(css) {
  const rules = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of text.matchAll(pattern)) rules.push({ selector: match[1].trim(), body: match[2] });
  return rules;
}

test('source text has no em dash outside vendored third-party files', () => {
  const offenders = [];
  for (const top of ['apps', 'packages', 'scripts', 'workers']) {
    for (const path of SourceFiles(resolve(root, top))) {
      if (vendoredPaths.some(pattern => pattern.test(path))) continue;
      // Tests may name the code point to assert it is absent from rendered output.
      const escaped = path.endsWith('.test.mjs') ? null : /\\u2014|&mdash;|&#8212;/;
      read(path).split('\n').forEach((line, index) => {
        if (line.includes(emDash) || escaped?.test(line)) offenders.push(`${path}:${index + 1}`);
      });
    }
  }
  assert.deepEqual(offenders, []);
});

test('training-panel navigation buttons keep a visible keyboard focus ring in every game', () => {
  const missing = [];
  for (const game of readdirSync(gamesRoot)) {
    let css;
    try { css = readFileSync(join(gamesRoot, game, 'rules.css'), 'utf8'); } catch { continue; }
    const rules = CssRules(css);
    for (const rule of rules) {
      if (rule.selector.includes('training-config-navigation-buttons') && /outline\s*:\s*(none|0)\b/.test(rule.body)) {
        missing.push(`${game}/rules.css removes the outline on ${rule.selector.split('\n')[0]}`);
      }
    }
    const ring = rules.some(rule => /training-config-navigation-buttons\s+\.btn:focus-visible/.test(rule.selector)
      && /outline\s*:\s*3px solid var\(--primary/.test(rule.body));
    if (!ring) missing.push(`${game}/rules.css has no focus-visible ring for navigation buttons`);
  }
  assert.deepEqual(missing, []);
});

test('hart chart decoder handle and code inputs show a focus ring, not only a tinted border', () => {
  const rules = CssRules(read('apps/rehabtrainerhub/games/hart-chart/styles/hart-chart.css'));
  for (const control of ['.hart-decoder-drag-handle', '.hart-code-input']) {
    const focus = rules.filter(rule => rule.selector.includes(`${control}:focus-visible`));
    assert.ok(focus.length > 0, `${control} has no focus-visible rule`);
    for (const rule of focus) assert.doesNotMatch(rule.body, /outline\s*:\s*(none|0)\b/);
    assert.ok(focus.some(rule => /outline\s*:\s*3px solid/.test(rule.body)), `${control} focus ring is not a 3px outline`);
  }
});

test('form control borders reach 3:1 against their surfaces in the Hub and every R2 game', () => {
  const hubRoot = read('apps/rehabtrainerhub/app/globals.css').split('}')[0];
  const hubStrong = hubRoot.match(/--border-strong:\s*(#[0-9a-f]{3,6})/i)?.[1];
  assert.ok(hubStrong);
  assert.ok(Contrast(hubStrong, '#ffffff') >= 3 && Contrast(hubStrong, '#f6f7f9') >= 3, `Hub --border-strong ${hubStrong}`);
  const hubRules = CssRules(read('apps/rehabtrainerhub/app/globals.css'));
  const search = hubRules.find(rule => rule.selector === '.module-search input');
  assert.match(search.body, /(?:^|;)\s*border\s*:\s*1px solid var\(--border-strong\)/, 'Lobby search field needs a visible boundary.');
  const placeholder = hubRules.find(rule => rule.selector === '.module-search input::placeholder');
  assert.match(placeholder.body, /color\s*:\s*var\(--text-muted\)/, 'Search placeholder uses the 4.5:1 muted text token.');
  for (const game of r2Games) {
    const files = [...SourceFiles(join(gamesRoot, game))].filter(path => path.endsWith('.css'));
    const css = files.map(path => read(path)).join('\n');
    const strong = [...css.matchAll(/--border-strong:\s*(#[0-9a-f]{3,6})/gi)].map(match => match[1]);
    assert.ok(strong.length > 0, `${game} defines --border-strong`);
    for (const value of strong) {
      assert.ok(Contrast(value, '#ffffff') >= 3 && Contrast(value, '#f6f7f9') >= 3, `${game} --border-strong ${value}`);
    }
    for (const rule of CssRules(css)) {
      // .hart-code-input is the decoder's text field, styled by class instead of element.
      const control = rule.selector.split(',').some(part => /(?:^|[\s>])(input|select|textarea)\b(?![-\w])|\.hart-code-input$/.test(part.trim())
        && !/type=checkbox|type="checkbox"|:focus/.test(part));
      if (control && /(?:^|;)\s*border\s*:[^;]*var\(--border\)/.test(rule.body)) {
        assert.fail(`${game}: ${rule.selector.trim()} uses the 1.42:1 --border token for a form control`);
      }
    }
  }
  const toggles = CssRules(read('apps/rehabtrainerhub/games/oculomotor-training/game.css'))
    .find(rule => rule.selector.startsWith('.training-direction-compass-grid button'));
  assert.match(toggles.body, /border\s*:\s*1px solid var\(--border-strong\)/, 'Oculomotor setting toggles need a 3:1 boundary.');
});

test('lobby card actions move to their own line when the labels do not fit side by side', () => {
  // The card clips its overflow, so an action that cannot shrink below its label must wrap instead.
  const rules = CssRules(read('apps/rehabtrainerhub/app/globals.css'));
  const card = rules.find(rule => rule.selector === '.module-card');
  assert.match(card.body, /overflow\s*:\s*hidden/);
  const footer = rules.filter(rule => rule.selector === '.official-game-actions');
  assert.ok(footer.some(rule => /flex-wrap\s*:\s*wrap/.test(rule.body)),
    'English labels are wider than a three-column card on 3:2 screens; the actions must wrap.');
  const actions = rules.filter(rule => /\.official-game-actions\s*>\s*(a|button)\b/.test(rule.selector));
  assert.ok(actions.some(rule => /white-space\s*:\s*nowrap/.test(rule.body)), 'Labels stay on one line inside each button.');
  for (const rule of actions) {
    assert.doesNotMatch(rule.body, /min-width\s*:\s*0/, 'A zero min-width squeezes the label instead of wrapping the button.');
  }
});

test('Hub copy states the scanner and credential facts that the code and AGENTS.md support', () => {
  const ruleCount = (read('apps/rehabtrainerhub/functions/_lib/gamePackages.js')
    .match(/const blockedSourcePatterns = \[([\s\S]*?)\n\];/)?.[1].match(/^\s*\['[a-z-]+',/gm) ?? []).length;
  assert.ok(ruleCount > 0);
  for (const [path, pattern] of [
    ['apps/rehabtrainerhub/app/i18n/zh-TW.ts', /(\d+)\s*種危險/],
    ['apps/rehabtrainerhub/app/i18n/en.ts', /(\d+)\s+dangerous APIs/],
    ['README.md', /(\d+)\s*種危險/],
  ]) {
    const claimed = read(path).match(pattern)?.[1];
    if (claimed !== undefined) assert.equal(Number(claimed), ruleCount, `${path} claims ${claimed} rules`);
  }
  const en = read('apps/rehabtrainerhub/app/i18n/en.ts');
  assert.doesNotMatch(en, /Board-Certified/, 'Board certification is not a verified credential.');
  assert.match(en, /passed the Taiwan occupational therapist licensing examination/i);
});

test('the site tour names the navigation and category labels the lobby actually shows', async () => {
  const { trainerCategoryTags } = await import('../apps/rehabtrainerhub/games/gameTags.js');
  for (const [path, language] of [['apps/rehabtrainerhub/app/i18n/zh-TW.ts', 'zh-TW'], ['apps/rehabtrainerhub/app/i18n/en.ts', 'en']]) {
    const source = read(path);
    const tour = source.slice(source.indexOf('tour: {'));
    const navigationItems = [...source.match(/navigationItems: \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
    const navigationText = tour.match(/navigation: \{[^}]*text: '([^']+)'/)[1];
    for (const item of navigationItems) assert.ok(navigationText.includes(item), `${language} tour navigation omits ${item}`);
    const filterText = tour.match(/filters: \{[^}]*text: '([^']+)'/)[1];
    for (const tag of trainerCategoryTags) {
      assert.ok(filterText.includes(tag.label[language]), `${language} tour filters omit ${tag.label[language]}`);
    }
  }
});
