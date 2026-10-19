import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const gameRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games/hart-chart');

const han = /^\p{Script=Han}$/u;

test('Hart spotlights explain the chart, column-row decoding and tools in both languages and both scripts', async () => {
  const { GetHartTutorialSteps } = await LoadModule('rules/tutorialSteps.ts');
  for (const language of ['zh', 'en']) for (const characterSet of ['english', 'chinese']) {
    const steps = GetHartTutorialSteps(language, characterSet);
    assert.deepEqual(steps.map(step => step.target), ['.hart-chart-grid', '.hart-decoder-panel', '.hart-topbar-controls']);
    assert.match(steps[0].text, /10/);
    // The first number is the column and the second the row, as on a map or a spreadsheet.
    assert.match(steps[1].text, language === 'en' ? /\[column, row\][\s\S]*\[3,2\][\s\S]*3 columns[\s\S]*2 rows/ : /［欄,列］[\s\S]*［3,2］[\s\S]*第 3 欄[\s\S]*第 2 列/);
    assert.match(steps[2].text, /QR/);
    const reset = { zh: { english: '重置字母', chinese: '重置字表' }, en: { english: 'Reset Letters', chinese: 'Reset Characters' } }[language][characterSet];
    assert.ok(steps[2].text.includes(reset), 'The tour names the reset button as it is labelled.');
    if (characterSet === 'chinese') {
      assert.doesNotMatch(steps[0].title + steps[0].text + steps[1].text, language === 'en' ? /letter/i : /字母/);
      assert.match(steps[1].text, language === 'en' ? /input method/ : /輸入法/);
    }
    for (const step of steps) {
      assert.doesNotMatch(step.title + step.text, /治療|診斷|療效|改善|therap|diagnos|treat|improve/i, 'Player copy stays within practice wording.');
    }
  }
  assert.deepEqual(GetHartTutorialSteps('zh'), GetHartTutorialSteps('zh', 'english'), 'English letters stay the default.');
});

test('Hart tutorial renders the training chart, complete decoder and tools with the selected size and dock', async () => {
  for (const language of ['zh', 'en']) for (const characterSet of ['english', 'chinese']) for (const chartSize of ['small', 'medium', 'large']) for (const rounds of [5, 30]) {
    const settings = { chartSize, rounds, characterSet };
    const tutorial = await RenderHart('rules', settings, language);
    const playing = await RenderHart('playing', settings, language);
    for (const scene of [tutorial, playing]) {
      assert.ok(scene.find('hart-page'), 'The tutorial renders the actual training layout.');
      assert.equal(scene.all('hart-chart-cell').length, 100);
      assert.equal(scene.all('hart-code-input').length, rounds);
      assert.ok(scene.find('hart-decoder-panel'));
      assert.equal(scene.all('hart-tool-button').length, 3);
      if (characterSet === 'chinese') {
        assert.ok(scene.all('hart-chart-cell').every(cell => han.test(cell.props.children)), 'The chart shows Chinese characters.');
        assert.equal(scene.find('hart-chart-grid').props.lang, 'zh-Hant', 'Traditional Chinese glyphs are selected.');
      }
    }
    assert.deepEqual(tutorial.find('hart-chart-grid').props.style, playing.find('hart-chart-grid').props.style);
    assert.equal(tutorial.find('hart-page').props.className, playing.find('hart-page').props.className);
    assert.equal(tutorial.find('hart-page').props.inert, true, 'Training controls are unavailable during teaching.');
    const answer = characterSet === 'chinese' ? '字' : 'A';
    tutorial.find('hart-code-input').props.onChange({ target: { value: answer } });
    assert.deepEqual(tutorial.changes, [], 'Teaching cannot change answers or attempt counts.');
    playing.find('hart-code-input').props.onChange({ target: { value: answer, blur() {} } });
    assert.ok(playing.changes.length > 0, 'Training still accepts answers.');
  }
});

test('decoder fields show [column,row] and name the column first for screen readers', async () => {
  for (const characterSet of ['english', 'chinese']) for (const language of ['zh', 'en']) {
    const scene = await RenderHart('playing', { chartSize: 'medium', rounds: 30, characterSet }, language, { seed: 42 });
    const expected = (await ExpectedDecoder(characterSet, 42, 30)).tokens.filter(token => token.coordinate);
    const inputs = scene.all('hart-code-input');
    assert.equal(inputs.length, expected.length);
    assert.ok(expected.some(token => token.coordinate.row !== token.coordinate.col), 'The fixture tells the two orders apart.');
    inputs.forEach((input, index) => {
      const { row, col } = expected[index].coordinate;
      assert.equal(input.props.placeholder, `[${col},${row}]`);
      assert.equal(input.props['aria-label'], language === 'en' ? `Column ${col}, row ${row}` : `第 ${col} 欄，第 ${row} 列`);
    });
  }
});

test('decoder keeps each word together on one line with a space between words', async () => {
  for (const characterSet of ['english', 'chinese']) for (const rounds of [5, 10, 30]) for (const seed of [1, 42, 7]) {
    const scene = await RenderHart('playing', { chartSize: 'medium', rounds, characterSet }, 'zh', { seed });
    const decoder = await ExpectedDecoder(characterSet, seed, rounds);
    const words = scene.all('hart-code-word');
    const tokens = decoder.tokens.filter(token => token.char !== ' ');
    let next = 0;
    const text = words.map(word => [word.props.children].flat(Infinity).map(child => {
      const token = tokens[next++];
      if (child.props.className.includes('hart-code-input')) {
        assert.equal(child.props.placeholder, `[${token.coordinate.col},${token.coordinate.row}]`);
      } else {
        assert.equal(child.props.children, token.char);
      }
      return token.char;
    }).join('')).join(' ');
    assert.equal(next, tokens.length, 'Every character sits in a word group.');
    assert.equal(text, decoder.tokens.map(token => token.char).join('').replace(/ +/g, ' '), 'Words keep the sentence order and spacing.');
    const output = scene.find('hart-code-output');
    assert.equal(scene.all('hart-code-static').filter(node => /^\s*$/.test(node.props.children)).length, 0, 'Spaces are gaps between words, not empty cells.');
    const page = scene.find('hart-page').props.style;
    assert.match(page['--hart-cell-width'], /100cqi/, 'Cells narrow with the decoder so the longest word fits.');
    assert.match(page['--hart-word-need'], /var\(--hart-cell-min\)/, 'Side docks widen when the longest word needs it.');
    assert.ok(output, 'The decoder output renders.');
  }
  const css = await readFile(resolve(gameRoot, 'styles/hart-chart.css'), 'utf8');
  const rule = selector => TopLevelRules(css).filter(item => item.selector.split(',').map(part => part.trim()).includes(selector)).map(item => item.body).join(';');
  assert.match(rule('.hart-code-word'), /flex-wrap:\s*nowrap/);
  assert.match(rule('.hart-code-word'), /white-space:\s*nowrap/);
  assert.match(rule('.hart-code-output'), /flex-wrap:\s*wrap/);
  assert.match(rule('.hart-code-output'), /container-type:\s*inline-size/);
  const wordGap = Number(rule('.hart-code-output').match(/column-gap:\s*(\d+)px/)?.[1]);
  assert.ok(wordGap >= 10, 'Words are separated by a visible space.');
  assert.match(css, /width:\s*var\(--hart-cell-width\)/);
  assert.match(rule('.hart-decoder-dock-right .hart-workspace'), /var\(--hart-side-decoder\)/);
  assert.match(rule('.hart-decoder-dock-left .hart-workspace'), /var\(--hart-side-decoder\)/);
});

test('settings offer English letters or Chinese characters, and the choice reaches the summary', async () => {
  for (const language of ['zh', 'en']) {
    const menu = await RenderHart('menu', { chartSize: 'medium', rounds: 10, characterSet: 'english' }, language);
    const select = menu.named('characterSet');
    assert.ok(select, 'The decoder text choice is a setting.');
    assert.deepEqual([select.props.children].flat().map(option => option.props.value), ['english', 'chinese']);
    assert.deepEqual([select.props.children].flat().map(option => option.props.children), language === 'en' ? ['English letters', 'Chinese characters'] : ['英文字母', '中文字']);
    select.props.onChange({ target: { value: 'chinese' } });
    assert.deepEqual(menu.changes.at(-1), { chartSize: 'medium', rounds: 10, characterSet: 'chinese' });
    const chinese = await RenderHart('menu', { chartSize: 'medium', rounds: 10, characterSet: 'chinese' }, language);
    assert.match(Text(chinese.named('rounds').parent), language === 'en' ? /Requested decoder characters/ : /要求解碼字數/);
    assert.match(Text(menu.named('rounds').parent), language === 'en' ? /Requested decoder letters/ : /要求解碼字母數/);
    const confirmation = await RenderHart('rules', { chartSize: 'medium', rounds: 10, characterSet: 'chinese' }, language, { tourFinished: true });
    assert.match(Text(confirmation.find('training-config-summary')), language === 'en' ? /Decoder text：Chinese characters/ : /解碼文字：中文字/);
    assert.equal(Text(confirmation.all('hart-tool-button').at(-1)), language === 'en' ? 'Reset Characters' : '重置字表');
  }
});

test('Chinese answers are read after the input method finishes composing', async () => {
  const scene = await RenderHart('playing', { chartSize: 'medium', rounds: 10, characterSet: 'chinese' }, 'zh', { seed: 42 });
  const [first] = (await ExpectedDecoder('chinese', 42, 10)).tokens.filter(token => token.coordinate);
  const input = scene.find('hart-code-input');
  assert.equal(input.props.maxLength, undefined, 'Composition needs room for phonetic symbols.');
  assert.equal(input.props.lang, 'zh-Hant');
  const attempts = () => scene.changes.filter(change => typeof change === 'function').length;
  const answers = () => scene.changes.filter(Array.isArray);
  input.props.onCompositionStart({});
  input.props.onChange({ target: { value: 'ㄗㄠˇ' }, nativeEvent: { isComposing: true } });
  assert.equal(attempts(), 0, 'Phonetic symbols while composing are not answers.');
  assert.deepEqual(answers(), []);
  input.props.onCompositionEnd({ currentTarget: { value: first.char, blur() {} } });
  assert.equal(attempts(), 1);
  assert.equal(answers().at(-1)[0], first.char);
  // Safari sends one more input event with the composed text after compositionend.
  input.props.onChange({ target: { value: first.char, blur() {} }, nativeEvent: { isComposing: false } });
  assert.equal(attempts(), 1, 'The same composition counts once.');
  input.props.onCompositionStart({});
  input.props.onCompositionEnd({ currentTarget: { value: first.char, blur() {} } });
  assert.equal(attempts(), 1, 'A cancelled composition leaves the old character and is not a new entry.');
  input.props.onChange({ target: { value: `${first.char}ABC一`, blur() {} }, nativeEvent: { isComposing: false } });
  assert.equal(attempts(), 2);
  assert.equal(answers().at(-1)[0], '一', 'Only the last Chinese character counts.');
  input.props.onChange({ target: { value: 'abc', blur() {} }, nativeEvent: { isComposing: false } });
  assert.equal(answers().at(-1)[0], '', 'Text without a Chinese character clears the field.');
  assert.equal(attempts(), 2);
});

async function ExpectedDecoder(characterSet, seed, rounds) {
  if (characterSet === 'chinese') {
    const { CreateHartChineseChart, CreateHartChineseDecoder } = await LoadModule('logic/hartChineseChart.ts');
    return CreateHartChineseDecoder(CreateHartChineseChart(seed), seed, rounds);
  }
  const { CreateHartChart, CreateHartDecoder } = await LoadModule('logic/hartChart.ts');
  return CreateHartDecoder(CreateHartChart(seed), seed, rounds);
}

function Text(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(Text).join('');
  return Text(node.props?.children);
}

test('the final confirmation is painted above the inert training scene', async () => {
  const scene = await RenderHart('rules', { chartSize: 'medium', rounds: 10, characterSet: 'english' }, 'zh', { tourFinished: true });
  const confirmation = scene.find('training-panel');
  assert.ok(confirmation, 'The finished tour shows the final confirmation.');
  const sheets = await LoadBundledCss('main.tsx');
  const confirmationLayer = Number(WinningDeclaration(sheets, confirmation.props.className.split(' '), 'z-index'));
  const trainingLayer = Number(WinningDeclaration(sheets, scene.find('hart-page').props.className.split(' ').filter(Boolean), 'z-index'));
  assert.ok(confirmationLayer > trainingLayer,
    `Confirmation z-index ${confirmationLayer} must exceed the training scene ${trainingLayer}, or players only see an unusable training screen.`);
});

// Style sheets in the order Vite bundles them: depth-first through relative imports from the entry.
async function LoadBundledCss(entry) {
  const sheets = [];
  const seen = new Set();
  const visit = async path => {
    if (seen.has(path)) return;
    seen.add(path);
    if (path.endsWith('.css')) { sheets.push(await readFile(resolve(gameRoot, path), 'utf8')); return; }
    const source = await readFile(resolve(gameRoot, path), 'utf8');
    for (const [, specifier] of source.matchAll(/^import\s+(?:[^'"]*?from\s+)?['"](\.[^'"]+)['"]/gm)) {
      const target = posix.join(posix.dirname(path), specifier);
      const file = [target, `${target}.tsx`, `${target}.ts`].find(candidate => /\.(css|tsx?)$/.test(candidate) && existsSync(resolve(gameRoot, candidate)));
      if (file) await visit(file);
    }
  };
  await visit(entry);
  return sheets;
}

// Resolves a property for an element with these classes from top-level class-only rules: higher specificity wins, then the later rule.
function WinningDeclaration(sheets, classes, property) {
  let winner = null;
  for (const sheet of sheets) for (const rule of TopLevelRules(sheet)) {
    const value = rule.body.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`))?.[1].trim();
    if (!value) continue;
    for (const selector of rule.selector.split(',').map(part => part.trim())) {
      if (!/^(\.[\w-]+)+$/.test(selector)) continue;
      const required = selector.slice(1).split('.');
      if (required.every(name => classes.includes(name)) && required.length >= (winner?.specificity ?? 0)) winner = { specificity: required.length, value };
    }
  }
  return winner?.value;
}

function TopLevelRules(css) {
  const rules = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let start = 0;
  let selector = '';
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '{') {
      if (depth === 0) { selector = source.slice(start, index).trim(); start = index + 1; }
      depth++;
    } else if (source[index] === '}') {
      depth--;
      if (depth === 0) {
        if (!selector.startsWith('@')) rules.push({ selector, body: source.slice(start, index) });
        start = index + 1;
      }
    }
  }
  return rules;
}

async function RenderHart(phase, settings, language, { tourFinished = false, seed } = {}) {
  const changes = [];
  let finishTour = tourFinished;
  const { ChartScale } = await LoadModule('settings.ts');
  const chartModule = await LoadModule('logic/hartChart.ts');
  const dictionary = (await LoadModule(`i18n/${language}.ts`))[language];
  const dependencies = {
    './settings': await LoadModule('settings.ts'),
    './logic/hartChart': seed === undefined ? chartModule : { ...chartModule, CreateHartSeed: () => seed },
    './logic/hartChineseChart': await LoadModule('logic/hartChineseChart.ts'),
    './logic/decoderLayout': await LoadModule('logic/decoderLayout.ts'),
    './i18n/useT': { useT: () => ({ t: key => dictionary[key] ?? key, lang: language }) },
    react: {
      useState: initial => {
        let value = typeof initial === 'function' ? initial() : initial;
        if (value === 'menu') value = phase;
        if (value?.rounds) value = settings;
        if (initial === 1) value = ChartScale(settings.chartSize);
        // tourFinished is the component's first false state.
        if (initial === false && finishTour) { finishTour = false; value = true; }
        return [value, next => changes.push(next)];
      },
      useRef: current => ({ current }), useMemo: create => create(), useEffect() {}, useCallback: callback => callback,
    },
    'react/jsx-runtime': {
      jsx: (type, props) => typeof type === 'function' ? type(props) : ({ type, props }),
      jsxs: (type, props) => typeof type === 'function' ? type(props) : ({ type, props }),
    },
    './runtime/hubBridge': { IsHubGame: () => false },
  };
  const source = await readFile(resolve(gameRoot, 'HartChartPage.tsx'), 'utf8');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'window', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText)(name => dependencies[name] ?? {}, module, module.exports, {
    location: { hash: '', href: 'https://example.test/' }, matchMedia: () => ({ matches: false }), requestAnimationFrame() {},
  });
  const nodes = [];
  const visit = (node, parent) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(child => visit(child, parent)); return; }
    node.parent = parent;
    nodes.push(node);
    visit(node.props?.children, node);
  };
  visit(module.exports.HartChartPage());
  const all = className => nodes.filter(node => node.props?.className?.split(' ').includes(className));
  return { all, find: className => all(className)[0], named: name => nodes.find(node => node.props?.name === name), changes };
}

test('spotlight follows targets and resize; finishing, skipping, back and disposal clean up', async () => {
  for (const action of ['finish', 'skip', 'back', 'dispose']) {
    const dom = CreateDocument();
    const { StartTour } = await LoadModule('runtime/tour.ts', dom);
    const events = [];
    const steps = [
      { target: '.camera', title: 'Camera', text: 'Camera instructions', place: 'bottom' },
      { target: '.moves', title: 'Moves', text: 'Hold instructions', place: 'top' },
    ];
    const dispose = StartTour(steps, { lang: 'en', onEvent: event => events.push(event),
      onBack: () => events.push('back') });
    const spotlight = dom.elements.find(element => element.className === 'game-tour-spotlight');
    const panel = dom.elements.find(element => element.className === 'game-tour');
    const blocker = dom.elements.find(element => element.className === 'game-tour-blocker');
    assert.ok(blocker, 'Tutorial prevents interaction with the underlying game.');
    assert.equal(spotlight.style.left, '92px');
    assert.equal(spotlight.style.width, '216px');
    assert.equal(panel.children[0].textContent, 'Camera');
    assert.equal(dom.document.activeElement, panel.children[2]);
    const keyboard = { key: 'Tab', preventDefault() { this.prevented = true; } };
    panel.onkeydown(keyboard);
    assert.equal(keyboard.prevented, true);
    assert.equal(dom.document.activeElement, panel.children[3]);
    dom.targets['.camera'].left = 160;
    dom.window.dispatchEvent({ type: 'resize' });
    assert.equal(spotlight.style.left, '152px');
    dom.targets['.camera'].left = 200;
    dom.window.dispatchEvent({ type: 'game:tutorial-layout' });
    assert.equal(spotlight.style.left, '192px', 'Spotlight follows the tutorial after its responsive cards finish updating.');
    panel.children[2].onclick();
    assert.equal(panel.children[0].textContent, 'Moves');
    assert.equal(spotlight.style.left, '492px');
    if (action === 'finish') panel.children[2].onclick();
    if (action === 'skip') panel.children[3].onclick();
    if (action === 'back') panel.children[4].onclick();
    if (action === 'dispose') dispose();
    assert.equal(dom.elements.filter(element => !element.removed).length, 0);
    assert.equal(dom.listeners.size, 0);
    assert.equal(dom.document.activeElement, dom.previousFocus);
    assert.deepEqual(events, action === 'dispose' ? [] : [action === 'back' ? 'back' : `tour_${action === 'finish' ? 'done' : 'skip'}`]);
    dispose();
  }
});

test('Escape skips the tutorial and keeps the explanation inside a small viewport', async () => {
  const dom = CreateDocument();
  dom.window.innerWidth = 390;
  dom.window.innerHeight = 320;
  const { StartTour } = await LoadModule('runtime/tour.ts', dom);
  const events = [];
  StartTour([{ target: '.moves', title: 'Moves', text: 'Hold', place: 'bottom' }], {
    lang: 'zh-TW', onEvent: event => events.push(event), onBack: () => {},
  });
  const panel = dom.elements.find(element => element.className === 'game-tour');
  assert.ok(Number.parseFloat(panel.style.left) >= 8);
  assert.ok(Number.parseFloat(panel.style.top) >= 8);
  panel.onkeydown({ key: 'Escape', preventDefault() {} });
  assert.deepEqual(events, ['tour_skip']);
  assert.equal(dom.listeners.size, 0);
});

test('a tall explanation in a short viewport uses the larger free side and never covers the target', async () => {
  const dom = CreateDocument(320);
  dom.window.innerWidth = 752;
  dom.window.innerHeight = 485;
  dom.targets['.word'] = { left: 250, top: 115, width: 252, height: 60 };
  const { StartTour } = await LoadModule('runtime/tour.ts', dom);
  const dispose = StartTour([{ target: '.word', title: 'Word', text: 'Long English explanation', place: 'bottom' }], {
    lang: 'en', onEvent: () => {}, onBack: () => {},
  });
  const panel = dom.elements.find(element => element.className === 'game-tour');
  const top = Number.parseFloat(panel.style.top);
  const height = panel.getBoundingClientRect().height;
  assert.ok(top >= 175, `Panel starts below the target (top ${top}).`);
  assert.ok(top + height <= 485 - 8, 'Panel scrolls internally instead of leaving the viewport.');
  dom.window.innerHeight = 800;
  dom.window.dispatchEvent({ type: 'resize' });
  assert.equal(panel.style.maxHeight, '', 'Constraint is cleared when the panel fits again.');
  dispose();
});

async function LoadModule(path, dom = {}) {
  const source = await readFile(resolve(gameRoot, path), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', 'document', 'window', 'HTMLElement', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports, dom.document, dom.window, dom.HTMLElement);
  return module.exports;
}

function CreateDocument(panelHeight = 200) {
  const elements = [];
  const listeners = new Map();
  const targets = { '.camera': { left: 100, top: 100, width: 200, height: 120 },
    '.moves': { left: 500, top: 400, width: 280, height: 150 } };
  class Element {
    style = {};
    children = [];
    isConnected = true;
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    getBoundingClientRect() { return { width: Math.min(300, window.innerWidth - 16, Number.parseFloat(this.style.width) || Infinity),
      height: Math.min(panelHeight, Number.parseFloat(this.style.maxHeight) || Infinity) }; }
    focus() { document.activeElement = this; }
    remove() { this.removed = true; this.isConnected = false; }
  }
  const previousFocus = new Element();
  const document = { activeElement: previousFocus,
    createElement: () => new Element(),
    body: { append: (...children) => elements.push(...children) },
    querySelector: target => targets[target] && { getBoundingClientRect: () => ({ ...targets[target],
      right: targets[target].left + targets[target].width, bottom: targets[target].top + targets[target].height }) },
  };
  const window = { innerWidth: 1024, innerHeight: 768,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
    dispatchEvent: event => listeners.get(event.type)?.(event),
  };
  return { document, window, HTMLElement: Element, elements, listeners, targets, previousFocus };
}
