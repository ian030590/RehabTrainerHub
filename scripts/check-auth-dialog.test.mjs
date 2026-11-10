import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
function Nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(Nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...Nodes(tree.props?.children)];
}
function Text(tree) {
  if (Array.isArray(tree)) return tree.map(Text).join('');
  if (tree && typeof tree === 'object') return Text(tree.props?.children);
  return tree == null || typeof tree === 'boolean' ? '' : String(tree);
}

function AuthFixture(signedIn = false) {
  let cursor = 0, dirty = false, pendingEffects = [], tree, token = signedIn ? 'token' : null, currentUser = null;
  const slots = [], requests = [], timers = new Map(), changes = [], listeners = new Map();
  let timerId = 0;
  class Element {
    isConnected = true;
    focus() { document.activeElement = this; }
    checkVisibility() { return true; }
    closest() { return signedIn ? { id: 'hidden-account-panel' } : null; }
    querySelectorAll() { return this.focusables ?? []; }
  }
  const trigger = new Element();
  const document = { activeElement: trigger, body: { style: { overflow: '' } }, querySelector: () => trigger };
  const dialogs = new Map();
  const hooks = {
    useState(initial) {
      const slot = slots[cursor++] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slot.value, next => {
        const value = typeof next === 'function' ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; }
      }];
    },
    useRef(initial) { return (slots[cursor++] ??= { value: { current: initial } }).value; },
    useMemo(factory, dependencies) {
      const slot = slots[cursor++] ??= {};
      if (!slot.dependencies || dependencies.some((value, index) => !Object.is(value, slot.dependencies[index]))) {
        slot.dependencies = dependencies; slot.value = factory();
      }
      return slot.value;
    },
    useCallback(callback, dependencies) { return hooks.useMemo(() => callback, dependencies); },
    useEffect(effect, dependencies) {
      const slot = slots[cursor++] ??= {};
      if (!slot.dependencies || dependencies.some((value, index) => !Object.is(value, slot.dependencies[index]))) {
        slot.dependencies = dependencies;
        pendingEffects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const auth = {
    authChangedEvent: 'auth-change', authTokenKey: 'auth-token',
    GetAuthApiOrigin: () => 'https://hub.example', GetAuthToken: () => token,
    GetAuthUserIdFromToken: value => value ? 'player-1' : null,
    FetchCurrentAuthUser: (origin, signal) => new Promise(resolve => requests.push({ signal, resolve })),
    FetchSharedAuthSession: async () => null,
    SetAuthToken: value => { token = value; }, ClearAuthToken: () => { token = null; },
    LogoutAuthSession: async () => {}, IsAuthSessionMessage: () => false,
    LoginPasswordAccount: async () => { changes.push('login'); return { token: 'token', user: currentUser
      ?? { id: 'player-1', displayName: 'Player', profileCompleted: true } }; },
    SaveAuthProfile: async () => { throw new Error('fixture unavailable'); },
    RegisterPasswordAccount: async () => { changes.push('register'); },
  };
  const source = readFileSync(new URL('../packages/ui/src/components/AuthPanel.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const dependencies = {
    react: hooks, 'react/jsx-runtime': jsx, 'react-dom': { createPortal: (children, container) => ({ type: 'portal', props: { children, container } }) }, '../auth/authClient': auth,
    '../auth/identityGuard': { CreateIdentityGuard: () => () => Boolean(token) },
    './TurnstileWidget': { TurnstileWidget() {} },
  };
  const exports = {};
  runInNewContext(compiled, { exports, require: name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, AbortController, HTMLElement: Element, document, console: { warn() {} },
  window: {
    addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }, location: { href: 'https://hub.example/' },
  } });
  const props = { locale: 'en', onAuthChange: user => { currentUser = user; } };
  const Render = () => {
    cursor = 0; dirty = false;
    tree = exports.AuthPanel(props);
    for (const node of Nodes(tree)) {
      if (!node.props?.ref) continue;
      const key = node.props['aria-labelledby'] ?? node.type;
      let element = dialogs.get(key);
      if (!element) {
        element = Object.assign(new Element(), { open: false, modalCount: 0,
          showModal() { this.open = true; this.modalCount++; document.activeElement = this; },
          close() { this.open = false; },
          getBoundingClientRect() { return { left: 20, top: 20, right: 400, bottom: 600 }; },
        });
        dialogs.set(key, element);
      }
      node.props.ref.current = element;
    }
    const effects = pendingEffects; pendingEffects = [];
    effects.forEach(effect => effect());
  };
  Render();
  const fixture = {
    requests, changes, trigger, dialogs, document,
    Dispatch(name, event = {}) { listeners.get(name)?.forEach(listener => listener(event)); },
    Find: predicate => Nodes(tree).find(predicate), All: predicate => Nodes(tree).filter(predicate),
    Button: label => Nodes(tree).find(node => node.type === 'button' && Text(node) === label),
    async Flush() {
      for (let count = 0; count < 8; count++) {
        await new Promise(resolve => setImmediate(resolve));
        if (dirty) Render();
      }
    },
    async Guest() { requests[0].resolve(null); await fixture.Flush(); },
    async Open() { fixture.Button('Sign up / sign in').props.onClick(); await fixture.Flush(); },
    async ResolveCheck() { requests.at(-1).resolve(null); await fixture.Flush(); },
    async Profile() {
      requests[0].resolve({ id: 'player-1', displayName: 'Player', profileCompleted: false });
      await fixture.Flush();
    },
    Unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
  return fixture;
}

test('opening sign-in immediately shows a modal and announces the pending session check', async () => {
  const fixture = AuthFixture();
  await fixture.Guest(); await fixture.Open();
  const dialog = fixture.Find(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'auth-account-title');
  assert.ok(dialog, 'A slow session check must not leave sign-in looking unresponsive.');
  assert.ok(Nodes(dialog).some(node => node.props?.role === 'status' && /Checking sign-in/.test(Text(node))));
  assert.equal(fixture.dialogs.get('auth-account-title').open, true, 'The dialog must be opened through showModal().');
  assert.ok(Nodes(dialog).some(node => node.type === 'button' && /Cancel|Close/.test(Text(node))), 'Checking can be cancelled.');
  fixture.Unmount();
});

test('repeat sign-in clicks share one pending check; cancelling aborts it and keeps the dialog closed', async () => {
  const fixture = AuthFixture();
  await fixture.Guest(); await fixture.Open();
  fixture.Button('Sign up / sign in').props.onClick(); await fixture.Flush();
  assert.equal(fixture.requests.length, 2, 'Only the initial and one explicit session request should run.');
  const dialog = fixture.Find(node => node.type === 'dialog');
  const cancel = Nodes(dialog).find(node => node.type === 'button' && /Cancel|Close/.test(Text(node)));
  cancel.props.onClick(); await fixture.Flush();
  assert.equal(fixture.requests.at(-1).signal.aborted, true);
  fixture.requests.at(-1).resolve(null); await fixture.Flush();
  assert.equal(fixture.Find(node => node.type === 'dialog'), undefined);
  assert.equal(fixture.document.activeElement, fixture.trigger, 'Closing restores the launching focus.');
  fixture.Unmount();
});

test('Escape cancels the native modal without closing its parent account menu', async () => {
  const fixture = AuthFixture();
  await fixture.Guest(); await fixture.Open(); await fixture.ResolveCheck();
  const dialog = fixture.Find(node => node.type === 'dialog');
  assert.ok(dialog, 'Sign-in uses a native modal.');
  let prevented = false, stopped = false;
  dialog.props.onCancel({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  await fixture.Flush();
  assert.equal(prevented, true); assert.equal(stopped, true);
  assert.equal(fixture.Find(node => node.type === 'dialog'), undefined);
  assert.equal(fixture.document.activeElement, fixture.trigger);
  fixture.Unmount();
});

test('a cancelled check cannot finish a newer sign-in attempt', async () => {
  const fixture = AuthFixture();
  await fixture.Guest(); await fixture.Open();
  const cancelled = fixture.requests.at(-1);
  fixture.Find(node => node.type === 'dialog').props.onCancel({ preventDefault() {}, stopPropagation() {} });
  await fixture.Flush(); await fixture.Open();
  cancelled.resolve(null); await fixture.Flush();
  const dialog = fixture.Find(node => node.type === 'dialog');
  assert.ok(Nodes(dialog).some(node => node.props?.role === 'status'), 'The new attempt is still checking its own session.');
  assert.equal(fixture.Find(node => node.type === 'form'), undefined, 'A stale completion must not enable credentials early.');
  fixture.Unmount();
});

test('a storage session refresh supersedes the open check without leaving sign-in loading forever', async () => {
  const fixture = AuthFixture();
  await fixture.Guest(); await fixture.Open();
  const superseded = fixture.requests.at(-1);
  fixture.Dispatch('storage', { key: 'auth-token' });
  await fixture.Flush();
  assert.equal(fixture.requests.length, 3, 'Storage starts a replacement identity check.');
  superseded.resolve(null); fixture.requests.at(-1).resolve(null);
  await fixture.Flush();
  assert.ok(fixture.Find(node => node.type === 'form'), 'The current guest response must release the pending state.');
  assert.equal(fixture.Find(node => node.props?.role === 'status'), undefined);
  fixture.Unmount();
});

test('the automatic profile modal is portalled outside its potentially hidden account panel', async () => {
  const fixture = AuthFixture(true); await fixture.Profile();
  const portal = fixture.Find(node => node.type === 'portal');
  assert.ok(portal, 'A modal inside a hidden account popover is invisible despite matching :modal.');
  assert.equal(portal.props.container, fixture.document.body);
  assert.ok(Nodes(portal).some(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'auth-profile-title'));
  fixture.Unmount();
});

test('Tab and Shift+Tab wrap at the modal control boundaries', async () => {
  const fixture = AuthFixture(); await fixture.Guest(); await fixture.Open(); await fixture.ResolveCheck();
  const dialog = fixture.Find(node => node.type === 'dialog');
  const first = new fixture.trigger.constructor(), last = new fixture.trigger.constructor();
  dialog.props.ref.current.focusables = [first, last];
  let prevented = 0;
  fixture.document.activeElement = last;
  dialog.props.onKeyDown({ key: 'Tab', currentTarget: dialog.props.ref.current, shiftKey: false, preventDefault() { prevented++; } });
  assert.equal(fixture.document.activeElement, first, 'Forward Tab must return to the first control instead of browser chrome.');
  fixture.document.activeElement = first;
  dialog.props.onKeyDown({ key: 'Tab', currentTarget: dialog.props.ref.current, shiftKey: true, preventDefault() { prevented++; } });
  assert.equal(fixture.document.activeElement, last);
  assert.equal(prevented, 2);
  fixture.Unmount();
});

test('clicking the native backdrop closes sign-in while clicking its padding keeps it open', async () => {
  const fixture = AuthFixture();
  await fixture.Guest(); await fixture.Open(); await fixture.ResolveCheck();
  const dialog = fixture.Find(node => node.type === 'dialog');
  const element = dialog.props.ref.current;
  assert.equal(typeof dialog.props.onClick, 'function', 'Preserve the existing backdrop dismissal.');
  dialog.props.onClick({ target: element, currentTarget: element, clientX: 30, clientY: 30 });
  await fixture.Flush();
  assert.ok(fixture.Find(node => node.type === 'dialog'));
  dialog.props.onClick({ target: element, currentTarget: element, clientX: 5, clientY: 5 });
  await fixture.Flush();
  assert.equal(fixture.Find(node => node.type === 'dialog'), undefined);
  fixture.Unmount();
});

test('privacy is disclosed in full and password sign-in still requires explicit consent', async () => {
  const fixture = AuthFixture();
  await fixture.Guest(); await fixture.Open(); await fixture.ResolveCheck();
  const disclosure = fixture.Find(node => node.type === 'details' && /Privacy Policy/.test(Text(node)));
  assert.ok(disclosure, 'Keep long privacy content available through a native disclosure.');
  assert.ok(Nodes(disclosure).filter(node => node.type === 'li').length >= 5, 'All data-collection notices remain available.');
  assert.match(Text(disclosure), /physician|physician-diagnosed/);
  fixture.Find(node => node.type === 'input' && node.props.type === 'email').props.onChange({ target: { value: 'player@example.com' } });
  fixture.Find(node => node.type === 'input' && node.props.type === 'password').props.onChange({ target: { value: 'password123' } });
  await fixture.Flush();
  assert.equal(fixture.Find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  await fixture.Find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await fixture.Flush();
  assert.equal(fixture.changes.length, 0, 'Submitting directly also enforces consent.');
  assert.ok(fixture.Find(node => node.props?.role === 'alert' && /agree/.test(Text(node))));
  fixture.Find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  await fixture.Flush();
  assert.equal(fixture.Find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
  await fixture.Find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await fixture.Flush();
  assert.deepEqual(fixture.changes, ['login'], 'Valid credentials with explicit consent still sign in.');
  fixture.Unmount();
});

test('invalid profile save announces the error inside its modal', async () => {
  const fixture = AuthFixture(true); await fixture.Profile();
  fixture.Button('Save profile').props.onClick(); await fixture.Flush();
  const dialog = fixture.Find(node => node.type === 'dialog' && node.props['aria-labelledby'] === 'auth-profile-title');
  assert.ok(dialog, 'The profile editor uses the same modal isolation as sign-in.');
  const alert = Nodes(dialog).find(node => node.props?.role === 'alert');
  assert.ok(alert, 'Validation must be announced inside the visible profile dialog.');
  assert.match(Text(alert), /age, gender, and nationality/);
  assert.equal(fixture.document.activeElement, alert.props.ref?.current, 'The error is brought into view after saving a long questionnaire.');
  fixture.Unmount();
});

test('a profile request failure stays inside the dialog and returns focus to its error', async () => {
  const fixture = AuthFixture(true); await fixture.Profile();
  const selects = fixture.All(node => node.type === 'select');
  selects[0].props.onChange({ target: { value: '30-39' } });
  selects[1].props.onChange({ target: { value: 'woman' } });
  fixture.Find(node => node.type === 'input' && node.props.placeholder === 'For example: Taiwan').props.onChange({ target: { value: 'Taiwan' } });
  await fixture.Flush();
  await fixture.Button('Save profile').props.onClick(); await fixture.Flush();
  const dialog = fixture.Find(node => node.type === 'dialog');
  const alert = Nodes(dialog).find(node => node.props?.role === 'alert');
  assert.match(Text(alert), /Profile could not be saved/);
  assert.equal(fixture.document.activeElement, alert.props.ref?.current);
  fixture.Unmount();
});
