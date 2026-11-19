import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

const game = new URL('../apps/rehabtrainerhub/games/brake-reaction/', import.meta.url);
const readGame = path => readFile(new URL(path, game), 'utf8');
const tutorialFile = 'rules/BrakeReactionTutorial.tsx';

async function LoadGameFile(path, dependencies = {}, { document, window, HTMLElement } = {}) {
  const source = await readGame(path);
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  new Function('require', 'exports', 'document', 'window', 'HTMLElement', outputText)(name => {
    assert.ok(Object.hasOwn(dependencies, name), 'Unexpected dependency: ' + name);
    return dependencies[name];
  }, module.exports, document, window, HTMLElement);
  return module.exports;
}

async function RenderTutorial({ lang, showDistraction, ready, onStart, onDemo, onBack, document }) {
  const effects = [];
  const tours = [];
  const { BrakeReactionTutorial } = await LoadGameFile(tutorialFile, {
    react: { useEffect: effect => effects.push(effect), useRef: () => ({ current: null }) },
    'react/jsx-runtime': jsxRuntime,
    '../i18n/useT': { useT: () => ({ lang, copy: { start: 'Start practice', demo: 'Demo round', backSettings: 'Back to settings' } }) },
    '../runtime/tour': { StartTour: (...args) => tours.push(args) },
    './tutorialSteps': await LoadGameFile('rules/tutorialSteps.ts'),
  }, { document });
  const events = [];
  const view = BrakeReactionTutorial({
    title: 'Confirm settings', ready, showDistraction, roundCount: 6, settings: { speedKmh: 100 },
    summaryItems: [{ label: 'Speed', value: '100 km/h' }],
    onContinue: () => events.push('confirmation'), onStart, onDemo, onBack,
  });
  effects.forEach(effect => effect());
  return { markup: renderToStaticMarkup(view), view, tours, events };
}

function FindElement(tree, predicate) {
  if (!tree || typeof tree !== 'object') return;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const match = FindElement(child, predicate);
    if (match) return match;
  }
}

test('the game owns a spotlight runtime and styles with no package or cross-game imports', async () => {
  const [runtime, tutorial, css, rulesCss] = await Promise.all([
    readGame('runtime/tour.ts'), readGame(tutorialFile), readGame('game.css'), readGame('rules.css'),
  ]);
  assert.doesNotMatch(runtime, /^\s*import\b/m);
  assert.match(runtime, /export function StartTour\(/);
  assert.match(tutorial, /import \{ StartTour \} from '\.\.\/runtime\/tour'/);
  assert.match(tutorial, /StartTour\(/);
  for (const selector of ['game-tour-blocker', 'game-tour-spotlight', 'game-tour']) {
    assert.match(css + rulesCss, new RegExp('\\.' + selector + '\\s*\\{'));
  }
  assert.doesNotMatch(tutorial, /className="spotlight"/);
  assert.doesNotMatch(css + rulesCss, /\.spotlight\b/);
});

test('spotlight follows layout changes and releases focus and listeners on every exit', async () => {
  const elements = new Set();
  const listeners = new Map();
  const target = { left: 100, top: 238, width: 105, height: 60, right: 205, bottom: 298 };
  const window = {
    innerWidth: 320, innerHeight: 568,
    addEventListener: (key, handler) => listeners.set(key, handler),
    removeEventListener: key => listeners.delete(key),
  };
  const document = {
    body: { append: (...children) => children.forEach(element => elements.add(element)) },
    querySelector: () => ({ getBoundingClientRect: () => target }),
    createElement: () => new Element(),
  };
  class Element {
    isConnected = true;
    style = {};
    children = [];
    setAttribute() {}
    getBoundingClientRect() { return { width: 304, height: 200 }; }
    append(...children) { this.children.push(...children); }
    focus() { document.activeElement = this; }
    remove() { elements.delete(this); }
  }
  const previous = new Element();
  previous.focus();
  const { StartTour } = await LoadGameFile('runtime/tour.ts', {}, { document, window, HTMLElement: Element });
  for (const action of ['finish', 'skip', 'escape', 'back', 'dispose']) {
    const calls = [];
    const steps = [{ target: '.car', title: 'Watch your lane', text: 'Wait for brake lights', place: 'top' }];
    const dispose = StartTour(steps, { lang: 'en', onEvent: event => calls.push(event), onBack: () => calls.push('back') });
    const [blocker, spotlight, dialog] = elements;
    assert.equal(blocker.className, 'game-tour-blocker');
    const [next, skip, back] = dialog.children.at(-1).children;
    assert.equal(document.activeElement, next);
    target.left = 110;
    target.right = 215;
    for (const event of ['resize', 'scroll', 'game:tutorial-layout']) {
      assert.equal(typeof listeners.get(event), 'function');
      listeners.get(event)();
      assert.equal(spotlight.style.left, '102px');
      assert.equal(spotlight.style.width, '121px');
    }
    dialog.onkeydown({ key: 'Tab', shiftKey: true, preventDefault() {} });
    assert.equal(document.activeElement, back);
    if (action === 'finish') next.onclick();
    if (action === 'skip') skip.onclick();
    if (action === 'escape') dialog.onkeydown({ key: 'Escape', preventDefault() {} });
    if (action === 'back') back.onclick();
    if (action === 'dispose') dispose();
    assert.equal(elements.size, 0);
    assert.equal(listeners.size, 0);
    assert.equal(document.activeElement, previous);
    assert.deepEqual(calls, { finish: ['tour_done'], skip: ['tour_skip'], escape: ['tour_skip'], back: ['back'], dispose: [] }[action]);
  }
});

test('both languages explain brake timing, controls, rounds and pausing at real scene targets', async () => {
  for (const lang of ['zh', 'en']) for (const showDistraction of [false, true]) {
    const { markup, tours, events } = await RenderTutorial({ lang, showDistraction, ready: false });
    assert.match(markup, /<section\b[^>]*\bclass="[^"]*\bdriving\b[^"]*"[^>]*\binert=""/);
    assert.match(markup, /class="road-frame"[^>]*><canvas\b/);
    assert.match(markup, /class="drive-toolbar"/);
    assert.doesNotMatch(markup, /training-confirmation/);
    assert.equal(tours.length, 1);
    const [[steps, options]] = tours;
    assert.equal(options.lang, lang);
    for (const { target, title, text, place } of steps) {
      assert.match(target, /^[.#][\w-]+$/);
      const [prefix, ...name] = target;
      const attribute = prefix === '.' ? 'class' : 'id';
      assert.match(markup, new RegExp(attribute + '="(?:[^"]*\\s)?' + name.join('') + '(?:\\s[^"]*)?"'));
      assert.ok(title && text && ['top', 'bottom'].includes(place));
      assert.doesNotMatch(title + text, /\u2014|治療|診斷|療效|改善|therap|diagnos|treat|improve/i);
    }
    assert.equal(steps.some(step => step.target === '.messages'), showDistraction);
    assert.equal(/class="[^"]*\bmessages\b[^"]*"/.test(markup), showDistraction);
    assert.equal(markup.includes('class="answers"'), showDistraction);
    const copy = steps.map(step => step.text).join(' ');
    for (const rule of lang === 'en'
      ? [/brake lights/i, /Space/, /100 ms/, /speed/i, /six rounds/i, /Escape/, /discards/i]
      : [/煞車燈/, /空白鍵/, /100 毫秒/, /車速/, /六關/, /Esc/, /不保存/]) {
      assert.match(copy, rule);
    }
    const brakeStep = steps.find(step => step.target === '.brake-controls');
    assert.match(brakeStep.text, lang === 'en' ? /Space.*regardless of focus/ : /不論焦點.*空白鍵/);
    const messageStep = steps.find(step => step.target === '.messages');
    if (showDistraction) assert.match(messageStep.text, /Tab.*Enter/);
    const speedStep = steps.find(step => step.target === '.drive-speed');
    assert.match(speedStep.text, lang === 'en' ? /speed.+slow down/i : /車速.+減速/);
    assert.doesNotMatch(speedStep.title + speedStep.text, lang === 'en' ? /caption|cue/i : /提示/);
    assert.doesNotMatch(markup, /Brake lights in your lane|同車道煞車燈亮起/);
    for (const event of ['tour_done', 'tour_skip']) options.onEvent(event);
    assert.deepEqual(events, ['confirmation', 'confirmation']);
  }
});

test('confirmation has three actions, wraps focus in both directions and returns on Escape', async () => {
  const actions = [];
  const document = {};
  const { view, markup, tours } = await RenderTutorial({
    lang: 'en', ready: true, document,
    onStart: () => actions.push('start'), onDemo: () => actions.push('demo'), onBack: () => actions.push('back'),
  });
  assert.deepEqual(tours, []);
  assert.match(markup, /<section\b[^>]*\bclass="[^"]*\btraining-panel\b[^"]*"[^>]*\brole="dialog"/);
  const panel = FindElement(view, node => node.props?.role === 'dialog');
  const start = FindElement(panel, node => node.props?.id === 'start');
  const demo = FindElement(panel, node => node.props?.id === 'demo');
  const back = FindElement(panel, node => node.type === 'button' && node.props.children === 'Back to settings');
  for (const button of [start, demo, back]) {
    assert.equal(button?.props.type, 'button');
    button.props.onClick();
  }
  let prevented = false;
  const buttons = [start, demo, back].map(button => ({
    name: button.props.children,
    focus() { document.activeElement = this; },
  }));
  const currentTarget = { querySelectorAll: () => buttons };
  for (const shiftKey of [false, true]) {
    prevented = false;
    document.activeElement = shiftKey ? buttons[0] : buttons.at(-1);
    panel.props.onKeyDown({ key: 'Tab', shiftKey, currentTarget, preventDefault() { prevented = true; } });
    assert.ok(prevented);
    assert.equal(document.activeElement, shiftKey ? buttons.at(-1) : buttons[0]);
  }
  prevented = false;
  panel.props.onKeyDown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.deepEqual(actions, ['start', 'demo', 'back', 'back']);
});

test('the tutorial ships in brake-reaction 1.2.0', async () => {
  const pkg = JSON.parse(await readGame('package.json'));
  assert.equal(pkg.version, '1.2.0');
});
