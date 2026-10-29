import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as channelRules from '../packages/ui/src/selfContainedGame.js';

const appRoot = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const module = { runtimeId: 'reading-training', copy: { en: { title: 'Reading' }, 'zh-TW': { title: '閱讀' } } };
const session = { subjectId: '12345678-1234-4123-8123-123456789abc', recordId: '12345678-1234-4123-8123-123456789abc',
  token: 'session', version: '2.0.2', contentSha256: 'a'.repeat(64), capabilities: ['settings-storage'] };

async function Load(file, dependencies) {
  const source = await readFile(new URL(file, appRoot), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', 'require', 'window', 'document', 'fetch', 'MessageChannel', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'HTMLElement', output)(
    loaded, loaded.exports, name => dependencies[name] ?? {}, dependencies.window, dependencies.document,
    dependencies.fetch, dependencies.MessageChannel, () => 1, () => {}, () => 1, () => {}, class {});
  return loaded.exports;
}

function Hooks() {
  const slots = [];
  let cursor = 0;
  const effects = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) {
        slots[index]?.cleanup?.();
        slots[index] = { deps };
        effects.push(() => { slots[index].cleanup = effect(); });
      }
    },
    useMemo: callback => callback(),
    useCallback: callback => callback,
  };
  return { hooks, Render(component, props) { cursor = 0; return component(props); }, Flush() { effects.splice(0).forEach(effect => effect()); } };
}

function Elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(Elements);
  return [tree, ...Elements(tree.props?.children)];
}

function Jsx(type, props) { return { type, props }; }
async function Settle() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }

async function Overlay(options = {}) {
  const hooks = Hooks();
  const writes = [];
  const saves = [];
  const requests = [];
  const captured = [];
  const posted = [];
  let closed = 0;
  let notified = 0;
  let failSave = options.failSave;
  let port;
  const storage = { getItem: () => JSON.stringify({ speed: 10 }), setItem: (...args) => writes.push(args) };
  const dependencies = {
    react: hooks.hooks,
    'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
    '@rehab-trainer/ui/officialGameReleases.json': { 'reading-training': { origin: 'https://games.example', name: 'Reading' } },
    '@rehab-trainer/ui/selfContainedGame.js': channelRules,
    '@rehab-trainer/ui/auth/authClient': { GetAuthToken: () => 'account', GetAuthUserIdFromToken: () => 'player',
      SaveRemoteTrainingRecord: async (...args) => { saves.push(args); if (failSave) throw Error('offline'); return true; } },
    '@rehab-trainer/ui/storage/subjectId': { IsSubjectId: () => true, GetOrCreateSubjectIdForUser: () => session.subjectId, SetAccountSubjectId() {} },
    '@rehab-trainer/ui/fullscreen': { ExitFullscreenIfActive: async () => {} },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en' }) },
    '../i18n': { GetHubUiCopy: () => ({ practicePlans: { captureNotice: 'Adjust settings and press start.' } }) },
    '@rehab-trainer/ui/rawCoordinateRecorder.js': { CreateRawCoordinateRecorder: () => ({ Files: () => [], Reset() {} }) },
    '@rehab-trainer/ui/sensorInputHost.js': { CreateSensorInputHost: () => null },
    window: { localStorage: storage, location: { origin: 'https://hub.example' }, addEventListener() {}, removeEventListener() {}, scrollTo() {} },
    document: { addEventListener() {}, removeEventListener() {}, activeElement: null },
    fetch: async (url, init) => { requests.push([url, init]); return { ok: true, json: async () => ({ ...session, ...options.session }) }; },
    MessageChannel: class {
      constructor() { port = this.port1 = { postMessage: message => posted.push(message), start() {}, close() {} }; this.port2 = {}; }
    },
  };
  const component = (await Load('train/R2GameOverlay.tsx', dependencies)).R2GameOverlay;
  const props = { module, onClose: () => { closed += 1; }, onSaved: () => { notified += 1; },
    ...(options.planLaunch ? { planLaunch: options.planLaunch } : {}),
    ...(options.capture ? { captureSettings: settings => captured.push(settings) } : {}) };
  function Render() {
    const tree = hooks.Render(component, props);
    for (const element of Elements(tree)) {
      if (element.props?.ref && !element.props.ref.current) element.props.ref.current = element.type === 'iframe'
        ? { contentWindow: { postMessage: message => posted.push(message) } } : { showModal() {}, close() {}, focus() {} };
    }
    return tree;
  }
  Render(); hooks.Flush(); await Settle();
  const tree = Render();
  Elements(tree).find(element => element.type === 'iframe').props.onLoad();
  let sequence = 0;
  const init = posted.find(message => message.type === 'init');
  return { requests, writes, saves, captured, posted, init, tree, get closed() { return closed; }, get notified() { return notified; },
    async Send(type, payload = {}) {
      port.onmessage({ data: { schema: 'trainerhub.game/v1', gameId: module.runtimeId, version: session.version,
        sessionNonce: init.sessionNonce, sequence: sequence++, type, payload } });
      await Settle();
    }, AllowSave() { failSave = false; } };
}

const result = { config: { speed: 20 }, score: { schema: 'rehab-trainer.game-score/v1', gameId: 'reading-training', summary: {}, rounds: [] } };

test('plan launch binds its item, uses server settings, and never overwrites device memory', async () => {
  const overlay = await Overlay({ planLaunch: { planItemId: 'item-1', settings: { speed: 99 } }, session: { planSettings: { speed: 20 } } });
  assert.equal(JSON.parse(overlay.requests[0][1].body).planItemId, 'item-1');
  assert.deepEqual(overlay.init.settings, { speed: 20 }, 'The session, not the stale lobby copy, supplies settings.');
  await overlay.Send('settings', { speed: 20, sound: true });
  assert.deepEqual(overlay.writes, []);
  await overlay.Send('result', result);
  assert.equal(overlay.saves.length, 1);
  assert.equal(overlay.saves[0][1].planFollowed, true);
  assert.equal(overlay.notified, 1);
});

test('plan progress uses the last confirmed settings and does not substitute result config', async () => {
  const overlay = await Overlay({ planLaunch: { planItemId: 'item-1', settings: { speed: 20 } }, session: { planSettings: { speed: 20 } } });
  await overlay.Send('settings', { speed: 20 });
  await overlay.Send('settings', { speed: 30 });
  await overlay.Send('result', result);
  assert.equal(overlay.saves[0][1].planFollowed, false);
  const missing = await Overlay({ planLaunch: { planItemId: 'item-1', settings: {} }, session: { planSettings: { speed: 20 } } });
  await missing.Send('result', result);
  assert.equal(missing.saves[0][1].planFollowed, false);
});

test('a list without custom settings uses device memory and counts completion', async () => {
  const overlay = await Overlay({ planLaunch: { planItemId: 'item-1', settings: null }, session: { planSettings: null } });
  assert.deepEqual(overlay.init.settings, { speed: 10 });
  await overlay.Send('result', result);
  assert.equal(overlay.saves[0][1].planFollowed, true);
  const absent = await Overlay({ planLaunch: { planItemId: 'item-1', settings: null } });
  assert.deepEqual(absent.init.settings, { speed: 10 });
});

test('capture returns only validated settings, closes, and never saves results or memory', async () => {
  const overlay = await Overlay({ capture: true });
  await overlay.Send('settings', { authToken: 'secret' });
  assert.deepEqual(overlay.captured, []);
  await overlay.Send('result', result);
  await overlay.Send('retry');
  assert.deepEqual(overlay.saves, []);
  await overlay.Send('settings', { speed: 25, sound: false });
  assert.deepEqual(overlay.captured, [{ speed: 25, sound: false }]);
  assert.equal(overlay.closed, 1);
  assert.deepEqual(overlay.writes, []);
});

test('normal launches retain memory, result saving and retry acknowledgements without plan fields', async () => {
  const overlay = await Overlay({ failSave: true });
  assert.deepEqual(JSON.parse(overlay.requests[0][1].body), { gameId: 'reading-training', subjectId: session.subjectId });
  assert.deepEqual(overlay.init.settings, { speed: 10 });
  await overlay.Send('settings', { speed: 20 });
  assert.equal(overlay.writes.length, 1);
  await overlay.Send('result', result);
  assert.equal(overlay.posted.at(-1).state, 'error');
  assert.equal(overlay.notified, 0);
  overlay.AllowSave(); await overlay.Send('retry');
  assert.equal(overlay.posted.at(-1).state, 'saved');
  assert.equal(overlay.notified, 1);
  assert.equal(Object.hasOwn(overlay.saves[1][1], 'planFollowed'), false);
  await overlay.Send('retry');
  assert.equal(overlay.saves.length, 2, 'A saved result stays idempotent.');
});

test('normal overlay keeps private channel validation, sensor proxies, CSV and result files', async () => {
  const source = await readFile(new URL('train/R2GameOverlay.tsx', appRoot), 'utf8');
  for (const name of ['AcceptGameMessage', 'SaveRawCoordinateCsv', 'SaveOculomotorCsv', 'CreateHandTrackingBroker', 'CreateEyeTrackingBroker',
    'CreateSensorInputHost', 'StageResultFile', 'DownloadResultFile']) assert.match(source, new RegExp(`${name}\\(`));
  assert.match(source, /sandbox="allow-scripts"/);
  assert.doesNotMatch(source, /allow-same-origin/);
  assert.match(source, /captureSettings[\s\S]*captureNotice/);
  for (const name of ['GameOverlay', 'TrainingOverlay']) {
    const wrapper = await readFile(new URL(`train/${name}.tsx`, appRoot), 'utf8');
    for (const prop of ['planLaunch', 'captureSettings', 'onSaved']) assert.match(wrapper, new RegExp(`${prop}=\\{${prop}\\}`));
  }
  // The payload is transported by the existing outbox and fetch path.
  const client = await readFile(new URL('../../../packages/ui/src/auth/authClient.ts', appRoot), 'utf8');
  assert.match(client, /planFollowed\?: boolean/);
});

test('player section is immediately after the heading; existing filters and pagination stay connected', async () => {
  const lobby = await readFile(new URL('TrainingLobby.tsx', appRoot), 'utf8');
  assert.match(lobby, /<\/section>\s*<AssignedPracticePlan\s*\/>\s*<div className="lobby-layout"/);
  assert.match(lobby, /PaginateLobbyGames\(visibleGames, page\)/);
  const source = await readFile(new URL('AssignedPracticePlan.tsx', appRoot), 'utf8');
  assert.match(source, /user\?\.role === 'patient'/);
  assert.match(source, /if \(!isPlayer\) return null/);
  assert.match(source, /if \(!plan\) return null/);
  assert.match(source, /onSaved=\{/);
  assert.match(source, /planLaunch=\{/);
  assert.match(source, /AbortController/);
  assert.match(source, /role="alert"/);
});

test('staff exposes the tab to both staff roles, replaces disabled tab with notice, and uses the patient list', async () => {
  const source = await readFile(new URL('admin/AdminDashboard.tsx', appRoot), 'utf8');
  assert.match(source, /ProbePracticePlans/);
  assert.match(source, /plansAvailability === 'enabled'/);
  assert.match(source, /plansAvailability === 'disabled'[\s\S]*?copy\.unavailable/);
  assert.match(source, /<PracticePlanManager/);
  const manager = await readFile(new URL('admin/PracticePlanManager.tsx', appRoot), 'utf8');
  for (const pattern of [/patients/, /weeklyTarget/, /min=\{1\}/, /max=\{14\}/, /maxLength=\{60\}/, /maxLength=\{300\}/,
    /captureSettings=\{/, /settings: null/, /ArchiveAdminPracticePlan/, /confirm\(/, /copy\.replacesActive/]) assert.match(manager, pattern);
});

test('player API hides guests, disabled feature and missing lists; other errors remain retryable', async () => {
  let token = null;
  const requests = [];
  let response = { ok: true, status: 200, json: async () => ({ plan: null }) };
  const { FetchAssignedPracticePlan } = await Load('practicePlans.ts', {
    '@rehab-trainer/ui/auth/authClient': { GetAuthToken: () => token },
    fetch: async (...args) => { requests.push(args); return response; },
  });
  assert.equal(await FetchAssignedPracticePlan(), null);
  assert.equal(requests.length, 0);
  token = 'player';
  response = { ok: false, status: 404, json: async () => ({ error: 'Training plans are not enabled.' }) };
  assert.equal(await FetchAssignedPracticePlan(), null);
  response = { ok: true, status: 200, json: async () => ({ plan: null }) };
  assert.equal(await FetchAssignedPracticePlan(), null);
  response = { ok: false, status: 500, json: async () => ({ error: 'Unavailable' }) };
  await assert.rejects(FetchAssignedPracticePlan());
  assert.equal(requests[0][1].headers.Authorization, 'Bearer player');
});

test('staff API probes once per call and preserves credentials, validation errors and exact request bodies', async () => {
  const requests = [];
  let response = new Response(JSON.stringify({ error: 'Training plans are not enabled.' }), { status: 404 });
  const api = await Load('admin/adminApi.ts', {
    '@rehab-trainer/ui/auth/authClient': { GetAuthToken: () => 'staff', BuildApiUrl: (_, path) => path },
    window: { location: { origin: 'https://hub.example' } },
    fetch: async (...args) => { requests.push(args); return response.clone(); },
  });
  assert.equal(await api.ProbePracticePlans(), false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0][1].method, 'OPTIONS');
  response = new Response(null, { status: 204 });
  assert.equal(await api.ProbePracticePlans(), true);
  const input = { patientId: 'player', title: 'List', note: '', items: [{ gameId: module.runtimeId, weeklyTarget: 3, settings: null }] };
  response = new Response(JSON.stringify({ plan: { id: 'list' } }), { status: 201 });
  assert.deepEqual(await api.CreateAdminPracticePlan(input), { id: 'list' });
  assert.deepEqual(JSON.parse(requests.at(-1)[1].body), input);
  assert.equal(requests.at(-1)[1].credentials, 'include');
  assert.equal(requests.at(-1)[1].headers.get('Authorization'), 'Bearer staff');
  response = new Response(JSON.stringify({ error: 'Invalid training plan.' }), { status: 400 });
  await assert.rejects(api.CreateAdminPracticePlan(input), error => error.status === 400 && error.message === 'Invalid training plan.');
  response = new Response(JSON.stringify({ ok: true }));
  await api.ArchiveAdminPracticePlan('a/b');
  assert.ok(requests.at(-1)[0].endsWith('/a%2Fb/archive'));
  assert.equal(requests.at(-1)[1].method, 'POST');
});

test('staff dashboard omits the tab when disabled and exposes it to admin and therapist when enabled', async () => {
  for (const role of ['therapist', 'admin']) for (const enabled of [false, true]) {
    const hooks = Hooks();
    let probes = 0;
    const { AdminDashboard } = await Load('admin/AdminDashboard.tsx', {
      react: hooks.hooks, 'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
      '../HubNavigation': { useHubAuth: () => ({ user: { id: 'staff', role } }) },
      '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en' }) },
      '../i18n': { GetHubUiCopy: () => ({ practicePlans: { heading: 'Practice lists', unavailable: 'Not available yet' } }) },
      './adminApi': { ProbePracticePlans: async () => { probes++; return enabled; },
        FetchAdminOverview: async () => ({ summary: {}, patients: [] }), FetchAdminRecords: async () => ({ records: [], pagination: {} }) },
      window: { location: { search: '' } },
    });
    hooks.Render(AdminDashboard); hooks.Flush(); await Settle();
    const tree = hooks.Render(AdminDashboard);
    const tab = Elements(tree).find(element => element.props?.id === 'admin-tab-plans');
    assert.equal(Boolean(tab), enabled, role);
    assert.equal(Elements(tree).some(element => element.props?.children === 'Not available yet'), !enabled);
    assert.equal(probes, 1);
  }
});

test('switching staff accounts reloads the player picker from the current account overview', async () => {
  const hooks = Hooks();
  let userId = 'staff-1';
  let overviews = 0;
  const { AdminDashboard } = await Load('admin/AdminDashboard.tsx', {
    react: hooks.hooks, 'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
    '../HubNavigation': { useHubAuth: () => ({ user: { id: userId, role: 'therapist' } }) },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en' }) },
    '../i18n': { GetHubUiCopy: () => ({ practicePlans: {} }) },
    './adminApi': { ProbePracticePlans: async () => true,
      FetchAdminOverview: async () => { overviews++; return { summary: {}, patients: [] }; } },
    window: { location: { search: '' } },
  });
  hooks.Render(AdminDashboard); hooks.Flush(); await Settle();
  userId = 'staff-2';
  hooks.Render(AdminDashboard); hooks.Flush(); await Settle();
  assert.equal(overviews, 2);
});

test('staff editor captures and resets parameters, validates, creates a replacement, and confirms archive', async () => {
  let hooks = Hooks();
  const react = Object.fromEntries(Object.keys(hooks.hooks).map(name => [name, (...args) => hooks.hooks[name](...args)]));
  const dictionary = (await Load('i18n/en.ts', {})).en.hubUi.practicePlans;
  const t = (key, params) => dictionary[key.split('.').at(-1)].replace(/\{(\w+)\}/g, (_, name) => params[name]);
  const game = { id: module.runtimeId, title: 'Reading' };
  const created = [];
  const archived = [];
  let confirmed = false;
  const { PracticePlanManager } = await Load('admin/PracticePlanManager.tsx', {
    react, 'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
    '@rehab-trainer/hub-modules/catalog': { trainingCatalog: [] }, '@rehab-trainer/ui/officialGameReleases.json': {},
    '../gameCatalog': { BuildHubGameCatalog: () => [game] },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en', t }) },
    '../i18n': { GetHubUiCopy: () => ({ practicePlans: dictionary }) },
    '../PracticePlanDetails': { PracticePlanDetails: 'plan-details' }, '../train/GameOverlay': { GameOverlay: 'game-overlay' },
    './adminApi': { FetchAdminPracticePlan: async () => null, IsPracticePlansDisabled: () => false,
      CreateAdminPracticePlan: async input => { created.push(input); return { id: 'new-list', title: input.title }; },
      ArchiveAdminPracticePlan: async id => { archived.push(id); } },
    window: { confirm: () => confirmed },
  });
  const props = { patients: [{ id: 'player', displayName: 'Player' }], patientsStatus: 'ready', onUnavailable() {}, onRetryPatients() {} };
  let tree = hooks.Render(PracticePlanManager, props);
  Elements(tree).find(element => element.type === 'select').props.onChange({ target: { value: 'player' } });
  tree = hooks.Render(PracticePlanManager, props);
  const editor = Elements(tree).find(element => typeof element.type === 'function');
  hooks = Hooks();
  const Render = () => hooks.Render(editor.type, editor.props);
  const Find = predicate => Elements(Render()).find(predicate);
  const Button = label => Find(element => element.type === 'button' && element.props.children === label);
  Render(); hooks.Flush(); await Settle();
  assert.ok(Find(element => element.props?.children === dictionary.noList));
  await Find(element => element.type === 'form').props.onSubmit({ preventDefault() {} }); await Settle();
  assert.equal(created.length, 0);
  assert.ok(Find(element => element.props?.role === 'alert'));
  Find(element => element.type === 'input' && element.props.maxLength === 60).props.onChange({ target: { value: 'Week list' } });
  Find(element => element.type === 'select').props.onChange({ target: { value: game.id } });
  Button(dictionary.addItem).props.onClick();
  Find(element => element.type === 'input' && element.props.type === 'number').props.onChange({ target: { valueAsNumber: 3 } });
  Button(dictionary.capture).props.onClick();
  const overlay = Find(element => element.type === 'game-overlay');
  overlay.props.captureSettings({ speed: 25, sound: false }); overlay.props.onClose();
  assert.ok(Find(element => element.props?.children === '2 parameters set'));
  Button(dictionary.resetSettings).props.onClick();
  assert.ok(Find(element => element.props?.children === dictionary.defaults));
  Button('Remove Reading').props.onClick();
  assert.ok(Find(element => element.props?.children === dictionary.emptyItems));
  Find(element => element.type === 'select').props.onChange({ target: { value: game.id } });
  Button(dictionary.addItem).props.onClick();
  await Find(element => element.type === 'form').props.onSubmit({ preventDefault() {} }); await Settle();
  assert.deepEqual(created, [{ patientId: 'player', title: 'Week list', note: '', items: [{ gameId: game.id, weeklyTarget: 1, settings: null }] }]);
  assert.ok(Find(element => element.props?.children === dictionary.saved));
  Button(dictionary.archive).props.onClick(); await Settle();
  assert.deepEqual(archived, []);
  confirmed = true;
  Button(dictionary.archive).props.onClick(); await Settle();
  assert.deepEqual(archived, ['new-list']);
  assert.ok(Find(element => element.props?.children === dictionary.archived));
});

test('staff with no players sees the assignment explanation, and player details show API progress and earned title', async () => {
  const hooks = Hooks();
  const copy = (await Load('i18n/en.ts', {})).en.hubUi.practicePlans;
  const dependencies = { react: hooks.hooks, 'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en' }) },
    '../i18n': { GetHubUiCopy: () => ({ practicePlans: copy }) } };
  const { PracticePlanManager } = await Load('admin/PracticePlanManager.tsx', dependencies);
  const empty = hooks.Render(PracticePlanManager, { patients: [], patientsStatus: 'ready', role: 'therapist' });
  assert.ok(Elements(empty).some(element => element.props?.children === copy.assignmentHelp));
  const { PracticePlanDetails } = await Load('PracticePlanDetails.tsx', {
    'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx }, './i18n': dependencies['../i18n'],
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', t: (key, params) => `${key}:${JSON.stringify(params)}` }) },
  });
  const tree = PracticePlanDetails({ games: [{ id: 'reading-training', title: 'Reading' }], plan: {
    assignedBy: 'Staff', note: 'One note', week: { start: '2026-10-26', end: '2026-11-01', achieved: true },
    items: [{ id: 'item', gameId: 'reading-training', weeklyTarget: 3, completedThisWeek: 4 }],
    achievedWeeks: 9, currentStreak: 6, weeksToTitle: 0, titles: [{ id: 'six-week-streak' }],
  } });
  const nodes = Elements(tree);
  assert.ok(nodes.some(element => element.props?.children === 'practicePlans.progress:{"done":4,"target":3}'));
  assert.ok(nodes.some(element => element.props?.children === 'practicePlans.achievedWeeks:{"count":9}'));
  assert.ok(nodes.some(element => element.props?.children === copy.titleBadge));
  assert.ok(nodes.some(element => element.props?.dateTime === '2026-10-26'));
});

test('player section is absent for guests and staff, and refreshing a saved result keeps its overlay mounted', async () => {
  const hooks = Hooks();
  let user = null;
  let reply = null;
  let resolveRefresh;
  const game = { id: module.runtimeId, title: 'Reading' };
  const item = { id: 'item-1', gameId: game.id, settings: { speed: 20 } };
  const { AssignedPracticePlan } = await Load('AssignedPracticePlan.tsx', {
    react: hooks.hooks, 'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
    '@rehab-trainer/hub-modules/catalog': { trainingCatalog: [] },
    '@rehab-trainer/ui/officialGameReleases.json': {},
    './HubNavigation': { useHubAuth: () => ({ user }) },
    './gameCatalog': { BuildHubGameCatalog: () => [game] },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en' }) },
    './i18n': { GetHubUiCopy: () => ({ practicePlans: {} }) },
    './PracticePlanDetails': { PracticePlanDetails: 'plan-details' }, './train/GameOverlay': { GameOverlay: 'game-overlay' },
    './practicePlans': { FetchAssignedPracticePlan: () => reply instanceof Promise ? reply : Promise.resolve(reply) },
  });
  assert.equal(AssignedPracticePlan(), null);
  user = { id: 'staff', role: 'therapist' };
  assert.equal(AssignedPracticePlan(), null);
  user = { id: 'player', role: 'patient' };
  const child = AssignedPracticePlan();
  hooks.Render(child.type); hooks.Flush(); await Settle();
  assert.equal(hooks.Render(child.type), null, 'Disabled and absent lists both render nothing.');

  const playerHooks = Hooks();
  // A fresh mount models a list assigned before the next lobby visit.
  hooks.hooks.useState = playerHooks.hooks.useState;
  hooks.hooks.useRef = playerHooks.hooks.useRef;
  hooks.hooks.useEffect = playerHooks.hooks.useEffect;
  reply = { id: 'list', title: 'Practice', items: [item] };
  playerHooks.Render(child.type); playerHooks.Flush(); await Settle();
  let tree = playerHooks.Render(child.type);
  Elements(tree).find(element => element.type === 'plan-details').props.onStart(item);
  tree = playerHooks.Render(child.type);
  const overlay = Elements(tree).find(element => element.type === 'game-overlay');
  assert.deepEqual(overlay.props.planLaunch, { planItemId: item.id, settings: item.settings });
  reply = new Promise(resolve => { resolveRefresh = resolve; });
  overlay.props.onSaved();
  playerHooks.Render(child.type); playerHooks.Flush();
  tree = playerHooks.Render(child.type);
  assert.ok(Elements(tree).some(element => element.type === 'game-overlay'), 'Refreshing progress must not close the result screen.');
  resolveRefresh(null); await Settle();
});

test('new copy has both languages, parameter placeholders match and narrow layouts have accessible controls', async () => {
  const dictionaries = [];
  for (const [file, name] of [['en.ts', 'en'], ['zh-TW.ts', 'zhTW']]) {
    const loaded = await Load(`i18n/${file}`, {});
    dictionaries.push(loaded[name].hubUi.practicePlans);
  }
  assert.ok(dictionaries[0] && dictionaries[1]);
  assert.deepEqual(Object.keys(dictionaries[0]).sort(), Object.keys(dictionaries[1]).sort());
  for (const key of Object.keys(dictionaries[0])) assert.deepEqual(
    dictionaries[0][key].match(/\{\w+\}/g)?.sort(), dictionaries[1][key].match(/\{\w+\}/g)?.sort(), key);
  const css = await readFile(new URL('practicePlans.css', appRoot), 'utf8');
  assert.match(css, /min-height: 44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /flex-wrap: wrap/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});

test('any 404, including a non-JSON one, hides the player section instead of showing an error', async () => {
  let response;
  const { FetchAssignedPracticePlan } = await Load('practicePlans.ts', {
    '@rehab-trainer/ui/auth/authClient': { GetAuthToken: () => 'player' },
    fetch: async () => response,
  });
  response = { ok: false, status: 404, json: async () => { throw new SyntaxError('Unexpected token <'); } };
  assert.equal(await FetchAssignedPracticePlan(), null);
  response = { ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } };
  await assert.rejects(FetchAssignedPracticePlan(), /Unable to load practice list/);
});

test('the first lobby load shows no placeholder, so players without a list see no layout jump', async () => {
  const hooks = Hooks();
  const { AssignedPracticePlan } = await Load('AssignedPracticePlan.tsx', {
    react: hooks.hooks, 'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
    '@rehab-trainer/hub-modules/catalog': { trainingCatalog: [] },
    '@rehab-trainer/ui/officialGameReleases.json': {},
    './HubNavigation': { useHubAuth: () => ({ user: { id: 'player', role: 'patient' } }) },
    './gameCatalog': { BuildHubGameCatalog: () => [] },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: 'en', locale: 'en' }) },
    './i18n': { GetHubUiCopy: () => ({ practicePlans: { loading: 'Loading practice list' } }) },
    './PracticePlanDetails': { PracticePlanDetails: 'plan-details' }, './train/GameOverlay': { GameOverlay: 'game-overlay' },
    './practicePlans': { FetchAssignedPracticePlan: () => new Promise(() => {}) },
  });
  const child = AssignedPracticePlan();
  assert.equal(hooks.Render(child.type), null);
  hooks.Flush(); await Settle();
  assert.equal(hooks.Render(child.type), null);
});

test('the week line reads as a localized date range, not as progress with ISO dates', async () => {
  function Text(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(Text).join('');
    return Text(node.props?.children);
  }
  const plan = { assignedBy: 'Staff', note: '', week: { start: '2026-10-26', end: '2026-11-01', achieved: false },
    items: [], achievedWeeks: 0, currentStreak: 0, weeksToTitle: 6, titles: [] };
  for (const [file, language, locale, expected] of [['i18n/zh-TW.ts', 'zh-TW', 'zh-TW', '本週：10月26日至11月1日'],
    ['i18n/en.ts', 'en', 'en', 'This week: October 26 to November 1']]) {
    const dictionary = await Load(file, {});
    const copy = (dictionary.zhTW ?? dictionary.en ?? Object.values(dictionary)[0]).hubUi.practicePlans;
    const { PracticePlanDetails } = await Load('PracticePlanDetails.tsx', {
      'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx }, './i18n': { GetHubUiCopy: () => ({ practicePlans: copy }) },
      './i18n/HubLanguage': { useHubLanguage: () => ({ language, locale, t: key => key }) },
    });
    const week = Elements(PracticePlanDetails({ games: [], plan })).find(element => element.type === 'p'
      && Elements(element.props.children).some(child => child.props?.dateTime === '2026-10-26'));
    assert.equal(Text(week), expected);
  }
});

test('on phones every list item stacks its start button under the title, whatever the title length', async () => {
  const css = await readFile(new URL('practicePlans.css', appRoot), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width: 767px)'));
  assert.match(phone, /\.practice-plan-items > li\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*flex-start;/);
});
