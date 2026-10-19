import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const gameRoot = resolve(import.meta.dirname, '../apps/rehabtrainerhub/games/hart-chart');

test('Hart spotlights explain the chart, row-column decoding and tools in both languages', async () => {
  const { GetHartTutorialSteps } = await LoadModule('rules/tutorialSteps.ts');
  for (const language of ['zh', 'en']) {
    const steps = GetHartTutorialSteps(language);
    assert.deepEqual(steps.map(step => step.target), ['.hart-chart-grid', '.hart-decoder-panel', '.hart-topbar-controls']);
    assert.match(steps[0].text, /10/);
    assert.match(steps[1].text, language === 'en' ? /row[\s\S]*column/ : /列[\s\S]*欄/);
    assert.match(steps[2].text, /QR/);
    for (const step of steps) {
      assert.doesNotMatch(step.title + step.text, /治療|診斷|療效|改善|therap|diagnos|treat|improve/i, 'Player copy stays within practice wording.');
    }
  }
});

test('Hart tutorial renders the training chart, complete decoder and tools with the selected size and dock', async () => {
  for (const language of ['zh', 'en']) for (const chartSize of ['small', 'medium', 'large']) for (const rounds of [5, 30]) {
    const settings = { chartSize, rounds };
    const tutorial = await RenderHart('rules', settings, language);
    const playing = await RenderHart('playing', settings, language);
    for (const scene of [tutorial, playing]) {
      assert.ok(scene.find('hart-page'), 'The tutorial renders the actual training layout.');
      assert.equal(scene.all('hart-chart-cell').length, 100);
      assert.equal(scene.all('hart-code-input').length, rounds);
      assert.ok(scene.find('hart-decoder-panel'));
      assert.equal(scene.all('hart-tool-button').length, 3);
    }
    assert.deepEqual(tutorial.find('hart-chart-grid').props.style, playing.find('hart-chart-grid').props.style);
    assert.equal(tutorial.find('hart-page').props.className, playing.find('hart-page').props.className);
    assert.equal(tutorial.find('hart-page').props.inert, true, 'Training controls are unavailable during teaching.');
    tutorial.find('hart-code-input').props.onChange({ target: { value: 'A' } });
    assert.deepEqual(tutorial.changes, [], 'Teaching cannot change answers or attempt counts.');
    playing.find('hart-code-input').props.onChange({ target: { value: 'A' } });
    assert.ok(playing.changes.length > 0, 'Training still accepts answers.');
  }
});

test('the final confirmation is painted above the inert training scene', async () => {
  const scene = await RenderHart('rules', { chartSize: 'medium', rounds: 10 }, 'zh', { tourFinished: true });
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

async function RenderHart(phase, settings, language, { tourFinished = false } = {}) {
  const changes = [];
  let finishTour = tourFinished;
  const { ChartScale } = await LoadModule('settings.ts');
  const dependencies = {
    './settings': await LoadModule('settings.ts'),
    './logic/hartChart': await LoadModule('logic/hartChart.ts'),
    './i18n/useT': { useT: () => ({ t: key => key, lang: language }) },
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
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    nodes.push(node);
    visit(node.props?.children);
  };
  visit(module.exports.HartChartPage());
  const all = className => nodes.filter(node => node.props?.className?.split(' ').includes(className));
  return { all, find: className => all(className)[0], changes };
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
