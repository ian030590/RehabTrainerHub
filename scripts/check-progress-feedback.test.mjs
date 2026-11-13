import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { CreateIdentityGuard } from '../packages/ui/src/auth/identityGuard.ts';

const appRoot = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const Jsx = (type, props) => ({ type, props });
const Elements = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
  ? tree.flatMap(Elements) : [tree, ...Elements(tree.props?.children)];
const Text = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object'
  ? String(tree) : Array.isArray(tree) ? tree.map(Text).join(' ') : Text(tree.props?.children);
const Find = (tree, predicate) => Elements(tree).find(predicate);
const Deferred = () => {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
};
async function Settle() { for (let i = 0; i < 10; i += 1) await Promise.resolve(); }

function Hooks() {
  const slots = [], effects = [];
  let cursor = 0;
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
      },
      useRef(initial) { return slots[cursor++] ??= { current: initial }; },
      useEffect(effect, deps) {
        const index = cursor++;
        if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) {
          slots[index]?.cleanup?.();
          slots[index] = { deps };
          effects.push(() => { slots[index].cleanup = effect(); });
        }
      },
      useMemo: callback => callback(), useCallback: callback => callback,
    },
    Render(component, props) { cursor = 0; return component(props); },
    Flush() { effects.splice(0).forEach(effect => effect()); },
  };
}

async function Load(file, dependencies) {
  const source = await readFile(new URL(file, appRoot), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('exports', 'require', 'fetch', 'console', output)(loaded.exports,
    name => dependencies[name] ?? {}, dependencies.fetch, { warn() {} });
  return loaded.exports;
}

async function Fixture(language = 'en') {
  const dictionary = await Load(`i18n/${language}.ts`, {});
  const copy = (dictionary.en ?? dictionary.zhTW).hubUi;
  const hooks = Hooks();
  let user = { id: 'patient-1', role: 'patient' };
  const progressRequests = [], csvRequests = [], planRequests = [];
  const dependencies = {
    react: hooks.react, 'react/jsx-runtime': { jsx: Jsx, jsxs: Jsx },
    'next/link': { default: 'a' },
    '@rehab-trainer/ui/auth/identityGuard': { CreateIdentityGuard },
    '@rehab-trainer/ui/auth/authClient': {
      GetAuthToken: () => user?.id ?? null,
      FetchRehabProgress: () => { const request = Deferred(); progressRequests.push(request); return request.promise; },
    },
    '@rehab-trainer/hub-modules/catalog': { trainingCatalog: [] },
    '@rehab-trainer/ui/officialGameReleases.json': {},
    '../HubNavigation': { useHubAuth: () => ({ user }) },
    './HubNavigation': { useHubAuth: () => ({ user }) },
    '../i18n': { GetHubUiCopy: () => copy }, './i18n': { GetHubUiCopy: () => copy },
    '../i18n/HubLanguage': { useHubLanguage: () => ({ language: language === 'en' ? 'en' : 'zh', locale: language, t: key => key }) },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: language === 'en' ? 'en' : 'zh', locale: language, t: key => key }) },
    '../siteUrls': { siteUrls: { hub: 'https://hub.example' } },
    './gameCatalog': { BuildHubGameCatalog: () => [{ id: 'reading-training', title: 'Reading' }] },
    './PracticePlanDetails': { PracticePlanDetails: 'plan-details' }, './train/GameOverlay': { GameOverlay: 'game-overlay' },
    './practicePlans': { FetchAssignedPracticePlan: () => { const request = Deferred(); planRequests.push(request); return request.promise; } },
    fetch: (url, init) => { const request = Deferred(); csvRequests.push({ ...request, url, init }); return request.promise; },
  };
  const { ProgressDashboard } = await Load('progress/ProgressDashboard.tsx', dependencies);
  const { AssignedPracticePlan } = await Load('AssignedPracticePlan.tsx', dependencies);
  let component = ProgressDashboard;
  return {
    copy, progressRequests, csvRequests, planRequests,
    UsePlan() { component = AssignedPracticePlan; },
    SetUser(next) { user = next; },
    Render() {
      let tree = hooks.Render(component);
      if (component === AssignedPracticePlan && typeof tree?.type === 'function') tree = hooks.Render(tree.type);
      return tree;
    },
    Flush: () => hooks.Flush(),
  };
}

const progress = {
  daysSinceStart: 29, rehabilitationDays: 7, startedOn: '2026-11-01', serverDate: '2026-11-10', timeZone: 'Asia/Taipei',
  dailyTasks: [{ id: 'complete-one', title: 'Complete one', current: 1, target: 1, completed: true }],
  achievements: [{ id: 'streak-7-days', title: 'Seven days', requiredDays: 7, achieved: true }], recentModules: [],
};
const Metrics = tree => Find(tree, node => node.props?.className === 'progress-metrics');
const Csv = tree => Find(tree, node => node.props?.['aria-labelledby'] === 'gaze-files-title');
const Retry = (tree, label) => Find(tree, node => node.type === 'button' && Text(node) === label);

for (const language of ['en', 'zh-TW']) {
  test(`${language}: an empty CSV list omits the storage and archival notice`, async () => {
    const fixture = await Fixture(language);
    fixture.Render(); fixture.Flush();
    fixture.csvRequests[0].resolve({ ok: true, json: async () => ({ records: [], cursor: null }) });
    await Settle();
    const section = Csv(fixture.Render());
    assert.ok(section, 'The CSV section remains available.');
    assert.doesNotMatch(Text(section), /No CSV files in site storage|本站儲存區目前沒有 CSV 檔案/);
  });

  test(`${language}: confirmed progress omits the server verification note and retains the date`, async () => {
    const fixture = await Fixture(language);
    fixture.Render(); fixture.Flush();
    fixture.progressRequests[0].resolve(progress);
    await Settle();
    const tree = fixture.Render();
    assert.ok(Find(tree, node => node.type === 'time' && node.props.dateTime === progress.serverDate));
    assert.doesNotMatch(Text(tree), /progress\.serverDate/);
  });

  test(`${language}: progress failure shows unavailable data and retry instead of zero results`, async () => {
    const fixture = await Fixture(language);
    let tree = fixture.Render(); fixture.Flush();
    assert.ok(!Elements(Metrics(tree)).some(node => node.type === 'strong' && Text(node) === '0'), 'Unresolved data is not a confirmed zero.');
    fixture.progressRequests[0].reject(Error('offline')); await Settle();
    tree = fixture.Render();
    assert.ok(!Text(Metrics(tree)).includes(fixture.copy.progress.noRecords), 'A request error is not an empty record history.');
    assert.equal(Elements(tree).filter(node => node.props?.role === 'progressbar').length, 0, 'Unavailable tasks have no invented zero progress.');
    assert.equal(Elements(tree).filter(node => node.props?.className === 'trophy-mark').length, 0, 'Unavailable achievements are not shown as unearned.');
    const retry = Retry(tree, fixture.copy.progress.retry);
    assert.ok(retry, 'Progress errors need a working retry.');
    retry.props.onClick(); fixture.Render(); fixture.Flush();
    assert.equal(fixture.progressRequests.length, 2);
    fixture.progressRequests[1].resolve(progress); await Settle(); tree = fixture.Render();
    assert.ok(Text(Metrics(tree)).includes('29'));
    assert.equal(Elements(tree).filter(node => node.props?.role === 'progressbar').length, 1);
  });

  test(`${language}: CSV initial failure has a retry that restores the records`, async () => {
    const fixture = await Fixture(language);
    fixture.Render(); fixture.Flush();
    fixture.csvRequests[0].reject(Error('offline')); await Settle();
    let tree = fixture.Render();
    const retry = Retry(Csv(tree), fixture.copy.progress.retry);
    assert.ok(retry, 'An initial CSV failure must offer recovery on the page.');
    retry.props.onClick(); fixture.Render(); fixture.Flush();
    assert.equal(fixture.csvRequests.length, 2);
    fixture.csvRequests[1].resolve({ ok: true, json: async () => ({ records: [{ recordId: 'record-1', uploadedAt: '2026-11-10T00:00:00Z', size: 10 }], cursor: null }) });
    await Settle(); tree = fixture.Render();
    assert.equal(Elements(Csv(tree)).filter(node => node.type === 'li').length, 1);
    assert.equal(Elements(Csv(tree)).filter(node => node.props?.role === 'alert').length, 0);
  });
}

test('a failed progress refresh preserves the previous confirmed metrics and hides them after identity changes', async () => {
  const fixture = await Fixture();
  fixture.Render(); fixture.Flush();
  fixture.progressRequests[0].resolve(progress); await Settle();
  fixture.SetUser({ id: 'patient-1', role: 'patient' });
  fixture.Render(); fixture.Flush();
  assert.ok(Text(Metrics(fixture.Render())).includes('29'), 'Confirmed values stay visible during reload.');
  fixture.progressRequests[1].reject(Error('offline')); await Settle();
  let tree = fixture.Render();
  assert.ok(Text(Metrics(tree)).includes('29'), 'A transient reload failure keeps the previous confirmed values.');
  Retry(tree, fixture.copy.progress.retry).props.onClick(); fixture.Render(); fixture.Flush();
  assert.equal(fixture.progressRequests.length, 3);
  assert.ok(Text(Metrics(fixture.Render())).includes('29'));
  fixture.SetUser({ id: 'patient-2', role: 'patient' });
  tree = fixture.Render();
  assert.ok(!Text(Metrics(tree)).includes('29'), 'A different identity never sees previous account metrics, even before effects run.');
});

test('a CSV download error keeps the confirmed list while retrying that download', async () => {
  const fixture = await Fixture();
  fixture.Render(); fixture.Flush();
  fixture.csvRequests[0].resolve({ ok: true, json: async () => ({ records: [{ recordId: 'record-1', uploadedAt: '2026-11-10T00:00:00Z', size: 10 }], cursor: null }) });
  await Settle();
  let tree = fixture.Render();
  Find(Csv(tree), node => node.type === 'li').props.children[2].props.onClick();
  fixture.csvRequests[1].reject(Error('offline')); await Settle(); tree = fixture.Render();
  const retry = Retry(Csv(tree), fixture.copy.progress.retry);
  assert.ok(retry);
  retry.props.onClick(); fixture.Render(); fixture.Flush();
  assert.equal(fixture.csvRequests[2].url, fixture.csvRequests[1].url, 'Retry repeats the failed download, rather than reloading the list.');
  assert.equal(Elements(Csv(fixture.Render())).filter(node => node.type === 'li').length, 1, 'Confirmed rows remain visible during reload.');
  fixture.csvRequests[2].reject(Error('offline')); await Settle();
  assert.equal(Elements(Csv(fixture.Render())).filter(node => node.type === 'li').length, 1);
});

test('a failed CSV next-page request retries the same page and preserves the existing rows', async () => {
  const fixture = await Fixture();
  fixture.Render(); fixture.Flush();
  fixture.csvRequests[0].resolve({ ok: true, json: async () => ({ records: [{ recordId: 'record-1', uploadedAt: '2026-11-10T00:00:00Z', size: 10 }], cursor: 'next-page' }) });
  await Settle(); let tree = fixture.Render();
  Find(Csv(tree), node => node.type === 'button' && Text(node) === 'Load more').props.onClick();
  fixture.csvRequests[1].reject(Error('offline')); await Settle(); tree = fixture.Render();
  Retry(Csv(tree), fixture.copy.progress.retry).props.onClick(); fixture.Render(); fixture.Flush();
  assert.equal(fixture.csvRequests[2].url, '/api/oculomotor-data?cursor=next-page');
  fixture.csvRequests[2].resolve({ ok: true, json: async () => ({ records: [{ recordId: 'record-2', uploadedAt: '2026-11-10T00:00:00Z', size: 10 }], cursor: null }) });
  await Settle();
  assert.equal(Elements(Csv(fixture.Render())).filter(node => node.type === 'li').length, 2);
});

test('a successful empty progress response still displays genuine zeros and empty history', async () => {
  const fixture = await Fixture(); fixture.Render(); fixture.Flush();
  fixture.progressRequests[0].resolve({ ...progress, daysSinceStart: 0, rehabilitationDays: 0, startedOn: null, dailyTasks: [], achievements: [] });
  await Settle(); const tree = fixture.Render();
  assert.equal(Elements(Metrics(tree)).filter(node => node.type === 'strong' && Text(node) === '0').length, 2);
  assert.ok(Text(Metrics(tree)).includes(fixture.copy.progress.noRecords));
});

test('the patient plan occupies a meaningful compact row while loading and when no plan exists', async () => {
  const fixture = await Fixture(); fixture.UsePlan();
  let tree = fixture.Render(); fixture.Flush();
  assert.ok(tree, 'A pending assigned list must not appear from zero height after the lobby is interactive.');
  assert.ok(Find(tree, node => node.props?.role === 'status'));
  assert.ok(Find(tree, node => String(node.props?.className ?? '').includes('assigned-practice-plan-row')));
  fixture.planRequests[0].resolve(null); await Settle(); tree = fixture.Render();
  assert.ok(Find(tree, node => String(node.props?.className ?? '').includes('assigned-practice-plan-row')), 'No-list uses the same compact row, not an empty gap or disappearing block.');
  assert.ok(Text(tree).includes(fixture.copy.practicePlans.noAssignedList));
});

test('a delayed assigned plan stays collapsed until requested and a failed refresh retains its details', async () => {
  const fixture = await Fixture(); fixture.UsePlan();
  fixture.Render(); fixture.Flush();
  const item = { id: 'item-1', gameId: 'reading-training', settings: null };
  fixture.planRequests[0].resolve({ id: 'plan-1', title: 'A long assigned plan title', items: [item], week: {}, titles: [] });
  await Settle(); let tree = fixture.Render();
  const disclosure = Find(tree, node => node.type === 'details');
  assert.ok(disclosure, 'List details must not push the current game results on asynchronous arrival.');
  assert.ok(!disclosure.props.open, 'The user controls expansion.');
  const overlay = Find(tree, node => typeof node.type === 'function' && node.props?.planLaunch);
  assert.equal(overlay, undefined);
  assert.ok(Text(tree).includes('A long assigned plan title'));
  Find(tree, node => node.type === 'plan-details').props.onStart(item);
  tree = fixture.Render();
  Find(tree, node => node.type === 'game-overlay').props.onSaved();
  fixture.Render(); fixture.Flush();
  fixture.planRequests[1].reject(Error('offline')); await Settle(); tree = fixture.Render();
  assert.ok(Find(tree, node => node.type === 'plan-details'));
  assert.ok(Find(tree, node => node.type === 'game-overlay'), 'A failed progress refresh keeps the current game result mounted.');
  assert.ok(Find(tree, node => node.props?.role === 'alert'));
  Retry(tree, fixture.copy.practicePlans.retry).props.onClick(); fixture.Render(); fixture.Flush();
  assert.equal(fixture.planRequests.length, 3);
});

test('a failed assigned-list lookup stays in the same row and retries without guessing that no plan exists', async () => {
  const fixture = await Fixture(); fixture.UsePlan();
  fixture.Render(); fixture.Flush();
  fixture.planRequests[0].reject(Error('offline')); await Settle();
  let tree = fixture.Render();
  assert.ok(Find(tree, node => String(node.props?.className ?? '').includes('assigned-practice-plan-row')));
  assert.ok(!Text(tree).includes(fixture.copy.practicePlans.noAssignedList));
  Retry(tree, fixture.copy.practicePlans.retry).props.onClick(); fixture.Render(); fixture.Flush();
  assert.equal(fixture.planRequests.length, 2);
  fixture.planRequests[1].resolve(null); await Settle(); tree = fixture.Render();
  assert.ok(Text(tree).includes(fixture.copy.practicePlans.noAssignedList));
});
