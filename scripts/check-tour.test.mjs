import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const repoRoot = resolve(import.meta.dirname, '..');

function TourFocusFixture() {
  const elements = new Map(), storage = new Map(), listeners = new Map(), focusCalls = [];
  let document;
  class TourElement {
    constructor(tag = 'div', id = '') {
      this.id = id; this.tagName = tag.toUpperCase(); this.parentElement = null; this.children = [];
      this.isConnected = false; this.tabIndex = tag === 'button' ? 0 : -1;
      this.attributes = new Map(); this.visibility = 'visible'; this.hidden = false; this.disabled = false;
      this.style = { setProperty() {}, removeProperty() {} };
      this.offsetWidth = 180; this.offsetHeight = 90; this.handlers = new Map();
      const classes = new Set();
      this.classList = {
        add: value => classes.add(value),
        remove: value => {
          classes.delete(value);
          if (this.id === 'ttTip' && value === 'show' && this.contains(document.activeElement)) document.activeElement = document.body;
        },
        toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
      };
    }
    appendChild(child) { child.parentElement = this; child.isConnected = true; this.children.push(child); elements.set(child.id, child); }
    contains(element) { for (let item = element; item; item = item.parentElement) if (item === this) return true; return false; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    hasAttribute(name) { return this.attributes.has(name); }
    matches(selector) {
      return selector.split(',').some(part => {
        const value = part.trim();
        if (value.startsWith('#')) return this.id === value.slice(1);
        if (value === ':disabled') return this.disabled;
        if (value === '[hidden]') return this.hidden || this.attributes.has('hidden');
        return value.startsWith('[') && this.attributes.has(value.slice(1, -1));
      });
    }
    closest(selector) { for (let item = this; item; item = item.parentElement) if (item.matches(selector)) return item; return null; }
    focus(options) { focusCalls.push({ element: this, options }); if (this.throwFocus) throw Error('Headless focus'); document.activeElement = this; }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    click() { this.handlers.get('click')?.(); }
    querySelector(selector) {
      const id = selector.slice(1);
      if (!elements.has(id)) this.appendChild(new TourElement(['ttNext', 'ttPrev', 'ttSkip'].includes(id) ? 'button' : 'div', id));
      return elements.get(id);
    }
    getBoundingClientRect() { return { top: 100, bottom: 200, left: 100, right: 300, width: 200, height: 100 }; }
    getClientRects() { return this.hidden || this.style.display === 'none' ? [] : [this.getBoundingClientRect()]; }
    remove() { this.isConnected = false; elements.delete(this.id); }
  }
  const body = new TourElement('body', 'body'); body.isConnected = true;
  const opener = new TourElement('button', 'opener'), target = new TourElement('div', 'target');
  body.appendChild(opener); body.appendChild(target);
  document = { body, activeElement: body, createElement: tag => new TourElement(tag), getElementById: id => elements.get(id),
    querySelector: () => target, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) };
  const window = { innerWidth: 1200, innerHeight: 900, matchMedia: () => ({ matches: true }),
    getComputedStyle: element => ({ borderRadius: '8px', visibility: element.visibility }) };
  const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const loaded = { exports: {} };
  const source = readFileSync(resolve(repoRoot, 'packages/ui/src/tour/toutourEngine.ts'), 'utf8');
  new Function('exports', 'document', 'window', 'HTMLElement', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout',
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(
    loaded.exports, document, window, TourElement, localStorage, () => 1, () => {}, () => 1, () => {});
  return { tour: loaded.exports, document, opener, elements, focusCalls, storage,
    steps: [{ target: '.target', text: 'Practice activity' }],
    escape: () => listeners.get('keydown')?.({ key: 'Escape', preventDefault() {} }),
    secondOpener: () => { const element = new TourElement('button', 'second-opener'); body.appendChild(element); return element; },
  };
}

for (const done of [false, true]) {
  test(`EndTour(${done}) returns focus to its opener without scrolling`, () => {
    const env = TourFocusFixture();
    env.opener.focus();
    assert.equal(env.tour.StartTour(env.steps), true);
    assert.equal(env.document.activeElement, env.elements.get('ttNext'));
    env.focusCalls.length = 0;
    env.tour.EndTour(done);
    assert.equal(env.document.activeElement.id, env.opener.id);
    assert.deepEqual(env.focusCalls, [{ element: env.opener, options: { preventScroll: true } }]);
  });
}

test('Escape, skip and the final Next button all return focus to the tour opener', () => {
  for (const close of ['escape', 'skip', 'done']) {
    const env = TourFocusFixture(); env.opener.focus(); env.tour.StartTour(env.steps);
    if (close === 'escape') env.escape();
    else env.elements.get(close === 'skip' ? 'ttSkip' : 'ttNext').click();
    assert.equal(env.tour.IsTourActive(), false);
    assert.equal(env.document.activeElement.id, env.opener.id, close);
  }
});

test('a tour with no previous focus closes without attempting to focus any element', () => {
  const env = TourFocusFixture(); env.tour.StartTour(env.steps); env.focusCalls.length = 0;
  assert.doesNotThrow(() => env.tour.EndTour(false));
  assert.deepEqual(env.focusCalls, []);
});

test('both fresh and saved ResumeTour paths restore the previously focused control', () => {
  for (const saved of [false, true]) {
    const env = TourFocusFixture(); env.opener.focus();
    if (saved) env.storage.set('resume-test:pos', JSON.stringify({ step: 2, at: Date.now() }));
    env.tour.ResumeTour([...env.steps, ...env.steps], { storageKey: 'resume-test' });
    env.tour.EndTour(false);
    assert.equal(env.document.activeElement.id, env.opener.id);
  }
});

test('restarting from inside a tour retains its external opener instead of a hidden tour control', () => {
  const env = TourFocusFixture(); env.opener.focus(); env.tour.StartTour(env.steps);
  env.tour.StartTour(env.steps); env.tour.EndTour(false);
  assert.equal(env.document.activeElement.id, env.opener.id);
});

test('restarting from a different external control returns focus to that new opener', () => {
  const env = TourFocusFixture(); env.opener.focus(); env.tour.StartTour(env.steps);
  const second = env.secondOpener(); second.focus();
  env.tour.StartTour(env.steps); env.tour.EndTour(false);
  assert.equal(env.document.activeElement.id, second.id);
});

test('closing skips openers that are detached, disabled, hidden, inert or no longer focusable', () => {
  for (const change of [element => { element.isConnected = false; }, element => { element.disabled = true; },
    element => { element.hidden = true; }, element => { element.visibility = 'hidden'; },
    element => { element.attributes.set('inert', ''); }, element => { element.style.display = 'none'; }]) {
    const env = TourFocusFixture(); env.opener.focus(); env.tour.StartTour(env.steps);
    change(env.opener); env.focusCalls.length = 0;
    assert.doesNotThrow(() => env.tour.EndTour(false));
    assert.deepEqual(env.focusCalls, []);
  }
});

test('focus errors are guarded and the saved opener is cleared before the next tour', () => {
  const env = TourFocusFixture(); env.opener.focus(); env.tour.StartTour(env.steps);
  env.opener.throwFocus = true;
  assert.doesNotThrow(() => env.tour.EndTour(false));
  env.opener.throwFocus = false; env.document.activeElement = env.document.body;
  env.tour.StartTour(env.steps); env.focusCalls.length = 0; env.tour.EndTour(false);
  assert.deepEqual(env.focusCalls, []);
});

function HubTour({ search = '', pathname = '/' } = {}) {
  const calls = [];
  const timers = new Map();
  const dictionaries = {};
  for (const [language, file] of [['zh', 'zh-TW'], ['en', 'en']]) {
    const loaded = { exports: {} };
    new Function('exports', ts.transpileModule(readFileSync(resolve(repoRoot,
      `apps/rehabtrainerhub/app/i18n/${file}.ts`), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText)(loaded.exports);
    dictionaries[language] = (loaded.exports.zhTW ?? loaded.exports.en).hubUi;
  }
  const dependencies = {
    react: { useEffect: effect => effect() },
    'next/navigation': { usePathname: () => pathname },
    '@rehab-trainer/ui/tour': {
      IsTourSeen: () => false,
      StartTour: (steps, options) => { calls.push({ kind: 'start', steps, options }); return true; },
      ResumeTour: (steps, options) => { calls.push({ kind: 'resume', steps, options }); return true; },
    },
    '../i18n': { GetHubUiCopy: language => dictionaries[language] },
  };
  const window = {
    location: { search },
    setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  };
  const loaded = { exports: {} };
  const source = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/tour/hubTour.ts'), 'utf8');
  new Function('exports', 'require', 'window', 'document', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(loaded.exports, name => dependencies[name], window, { querySelector: selector => selector });
  return { ...loaded.exports, calls, dictionaries, runTimers: () => timers.forEach(callback => callback()) };
}

test('a first lobby visit with empty storage leaves the tour closed', () => {
  const tour = HubTour();
  tour.useHubTourAutoStart('zh');
  tour.runTimers();
  assert.deepEqual(tour.calls, [], 'An unrequested first visit must not start or resume the tour.');
});

for (const search of ['?tour=1', '?tour=guide']) {
  test(`${search} forces the tour only on the lobby`, () => {
    const tour = HubTour({ search });
    tour.useHubTourAutoStart('en');
    tour.runTimers();
    assert.equal(tour.calls.length, 1);
    assert.equal(tour.calls[0].kind, 'start');
    assert.equal(tour.calls[0].options.storageKey, 'rehab_hub_tour_seen');
    const otherPage = HubTour({ search, pathname: '/progress/' });
    otherPage.useHubTourAutoStart('en');
    otherPage.runTimers();
    assert.equal(otherPage.calls.length, 0);
  });
}

test('the opt-in tour follows search, filters, activity, navigation and help in that order', () => {
  const tour = HubTour();
  for (const language of ['zh', 'en']) {
    const steps = tour.CreateHubTourSteps(language);
    assert.deepEqual(steps.map(step => typeof step.target === 'function' ? step.target() : step.target),
      ['.module-search', '.filter-panel', '.official-game-card', '.hub-nav', '#hub-guide-button']);
    assert.equal(Object.hasOwn(tour.dictionaries[language].tour.steps, 'welcome'), false);
  }
});

test('manual tours retain force, resume and completion storage options', () => {
  const tour = HubTour();
  assert.equal(tour.StartHubTour('en', { force: true }), true);
  assert.equal(tour.StartHubTour('en'), true);
  assert.deepEqual(tour.calls.map(call => call.kind), ['start', 'resume']);
  assert.ok(tour.calls.every(call => call.options.storageKey === 'rehab_hub_tour_seen'));
});

test('tour activity instructions explain the camera label and the independent window link', () => {
  const { dictionaries } = HubTour();
  assert.equal(dictionaries.zh.tour.steps.activityCards.text,
    '點選「開始訓練」開啟設定並開始練習。卡片上會標示是否需要攝影機；想用獨立視窗使用，可點選「安裝遊戲」。');
  assert.equal(dictionaries.en.tour.steps.activityCards.text,
    'Select "Start training" to adjust the settings and begin. Each card says whether a camera is needed; to use an activity in its own window, select "Install game".');
});

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

test('tour colors and corners resolve through Hub tokens with independent fallbacks', () => {
  const css = readFileSync(resolve(repoRoot, 'packages/ui/src/tour/toutour.css'), 'utf8');
  const root = css.match(/:root\s*\{([^}]+)\}/)[1];
  const expected = {
    surface: 'var(--surface, #ffffff)', text: 'var(--text, #262626)', muted: 'var(--text-muted, #525252)',
    accent: 'var(--primary, #262626)', 'accent-hover': 'var(--primary-hover, #0a0a0a)',
    'accent-bg': 'var(--primary-soft, #eaeaea)', border: 'var(--border-strong, #7d868e)',
    radius: 'var(--radius-lg, 12px)', mask: 'var(--bg-overlay, rgba(20, 24, 28, 0.54))',
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(root.match(new RegExp(`--tt-${key}:\\s*([^;]+);`))?.[1], value, key);
  }
  assert.doesNotMatch(root.match(/--tt-accent:\s*([^;]+);/)[1], /#146c5b/);
  assert.match(root, /--tt-halo:\s*rgba\(255, 255, 255, 0\.9\);/);
  const luminance = hex => [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  for (const [foreground, background] of [['262626', 'ffffff'], ['ffffff', '262626'], ['262626', 'eaeaea'], ['ffffff', '0a0a0a']]) {
    const [dark, light] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    assert.ok((light + .05) / (dark + .05) >= 4.5, 'Tour accent text must remain readable.');
  }
});
