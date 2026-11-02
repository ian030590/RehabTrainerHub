import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as results from '../apps/rehabtrainerhub/app/lobbyResults.js';

const appRoot = new URL('../apps/rehabtrainerhub/app/', import.meta.url);
const games = Array.from({ length: 14 }, (_, index) => ({
  id: `game-${index}`, title: `Activity ${index}`, summary: 'Practice at home', author: 'Hub',
  purpose: index < 4 ? 'attention' : 'memory', theme: { icon: { type: 'symbol', value: 'grid_view' } },
  installUrl: `/games/game-${index}/`, launch: { contract: 'catalog-v1', module: {} },
}));

function Elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(Elements);
  return [tree, ...Elements(tree.props?.children)];
}

function Text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (typeof tree !== 'object') return String(tree);
  if (Array.isArray(tree)) return tree.map(Text).join(' ');
  return Text(tree.props?.children);
}

async function Lobby(language = 'en') {
  const slots = [];
  const effects = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index][i])) {
        slots[index] = deps;
        // Only state effects run here; network and document setup belong to browser checks.
        if (deps.length) effects.push(effect);
      }
    },
    useCallback: callback => callback,
    useMemo: callback => callback(),
  };
  const dictionarySource = await readFile(new URL(`i18n/${language}.ts`, appRoot), 'utf8');
  const dictionary = { exports: {} };
  new Function('exports', ts.transpileModule(dictionarySource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(dictionary.exports);
  const copy = (dictionary.exports.en ?? dictionary.exports.zhTW).hubUi;
  const dependencies = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    './i18n': { GetHubUiCopy: () => copy },
    './i18n/HubLanguage': { useHubLanguage: () => ({ language: language === 'en' ? 'en' : 'zh', locale: language, t: key => key }) },
    './gameCatalog': { BuildHubGameCatalog: () => games },
    './lobbyResults.js': results,
    './trainingThemeStyle': { BuildTrainingThemeStyle: () => ({}) },
    '@rehab-trainer/ui/hooks/useBottomSheet': { useBottomSheet: () => ({ dialogRef: {}, isMobile: false }) },
    '@rehab-trainer/hub-modules/catalog': {
      trainingCatalog: [], trainingPurposes: [{ id: 'attention' }, { id: 'memory' }],
      trainerCategoryTags: [{ id: 'brain', label: { en: 'Cognition' } }],
      categorySubcategories: { brain: ['attention', 'memory'] },
      trainingThemes: Object.fromEntries(['attention', 'memory'].map(id => [id, { label: { en: id }, icon: {} }])),
      GetTrainerCategoryTheme: () => ({}),
    },
  };
  const source = await readFile(new URL('TrainingLobby.tsx', appRoot), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const loaded = { exports: {} };
  new Function('exports', 'require', 'document', compiled)(loaded.exports, name => dependencies[name] ?? {}, { activeElement: null });
  const render = () => { cursor = 0; const tree = loaded.exports.TrainingLobby(); effects.splice(0).forEach(effect => effect()); return Elements(tree); };
  return { render, copy, dictionary: dictionary.exports };
}

test('clearing a search returns focus to the field while keeping selected categories', async () => {
  const { render, copy } = await Lobby();
  let elements = render();
  elements.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange();
  elements.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'no match' } });
  elements = render();
  assert.ok(elements.some(node => node.props?.className === 'empty-results'));
  const clear = elements.find(node => node.props?.className === 'module-search-clear');
  assert.ok(clear, 'An entered search needs an explicit clear control.');
  assert.equal(clear.props['aria-label'], copy.lobby.clearSearch);
  let focused = false;
  elements.find(node => node.type === 'input' && node.props.type === 'search').props.ref.current = { focus() { focused = true; } };
  clear.props.onClick();
  elements = render();
  assert.equal(focused, true);
  assert.equal(elements.find(node => node.type === 'input' && node.props.type === 'search').props.value, '');
  assert.equal(elements.find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, true);
  assert.equal(elements.filter(node => node.type === 'article').length, 12);
});

test('the lobby offers a working guide anchor and preserves accessible search and heading', async () => {
  const { render } = await Lobby();
  const elements = render();
  assert.ok(elements.some(node => node.type === 'a' && node.props.href === '#lobby-guide'));
  assert.ok(elements.some(node => node.type === 'section' && node.props.id === 'lobby-guide'));
  assert.equal(elements.filter(node => node.type === 'h1').length, 1);
  const search = elements.find(node => node.type === 'input' && node.props.type === 'search');
  assert.ok(search);
  assert.ok(elements.some(node => node.type === 'label' && node.props.htmlFor === search.props.id));
});

for (const language of ['zh-TW', 'en']) {
  test(`${language} guide puts short starting instructions and score limits before optional details`, async () => {
    const { render, copy } = await Lobby(language);
    const guide = render().find(node => node.props?.id === 'lobby-guide');
    const elements = Elements(guide);
    const steps = elements.find(node => node.type === 'ol');
    assert.ok(steps, 'Starting instructions must be a scannable ordered list.');
    assert.equal(Elements(steps).filter(node => node.type === 'li').length, 2);
    assert.ok(Text(steps).includes(copy.lobby.guide.chooseBody));
    assert.ok(Text(steps).includes(copy.lobby.guide.prepareBody));
    const note = elements.find(node => node.props?.className === 'lobby-guide-note');
    assert.ok(note, 'Score limits stay visible without opening a disclosure.');
    assert.ok(Text(note).includes(copy.lobby.guide.limitsBody));
    assert.ok(elements.indexOf(note) < elements.findIndex(node => node.type === 'details'));
    const visibleText = elements.filter(node => node.type === 'p' &&
      !elements.filter(item => item.type === 'details').some(item => Elements(item).includes(node)))
      .map(Text).join(' ');
    assert.ok(language === 'en' ? visibleText.split(/\s+/).length <= 140 : visibleText.length <= 260,
      'The default guide must fit a short read.');
  });

  test(`${language} guide keeps login, privacy and review answers in native disclosures and retains useful links`, async () => {
    const { render, copy } = await Lobby(language);
    const guide = Elements(render().find(node => node.props?.id === 'lobby-guide'));
    const disclosures = guide.filter(node => node.type === 'details');
    assert.equal(disclosures.length, 3);
    for (const [index, key] of ['records', 'privacy', 'review'].entries()) {
      const disclosure = disclosures[index];
      assert.ok(!disclosure.props.open, 'Extra details are initially collapsed.');
      const content = Elements(disclosure);
      assert.equal(Text(content.find(node => node.type === 'summary')), copy.lobby.guide[`${key}Title`]);
      assert.equal(Text(content.find(node => node.type === 'p')), copy.lobby.guide[`${key}Body`],
        'The full answer must exist in the initial render, before interaction.');
    }
    assert.deepEqual(guide.filter(node => node.type === 'a').map(node => node.props.href),
      ['/about/', '/qa/', '/privacy/']);
    assert.doesNotMatch(Text(guide), /5000|5%|escape-character|iframe|Worker/,
      'Developer implementation details do not belong in the lobby guide.');
  });
}

test('homepage FAQ structured data matches every rendered guide heading and answer', async () => {
  const { render, dictionary } = await Lobby('zh-TW');
  const guide = Elements(render().find(node => node.props?.id === 'lobby-guide'));
  const source = await readFile(new URL('seo.ts', appRoot), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  const dependencies = {
    './i18n': dictionary,
    './hubBrand': { hubLocalName: '居家訓練網', hubAlternateNames: ['Rehab Trainer Hub'], hubFullName: '居家訓練網 Rehab Trainer Hub' },
    './siteUrls': { siteUrls: { hub: 'https://trainerhub.cc' } },
  };
  new Function('exports', 'require', compiled)(loaded.exports, name => dependencies[name]);
  const questions = loaded.exports.homepageFaqJsonLd.mainEntity;
  assert.equal(questions.length, 7);
  for (const question of questions) {
    assert.ok(guide.some(node => ['h2', 'h3'].includes(node.type) && Text(node) === question.name), question.name);
    assert.ok(guide.some(node => node.type === 'p' && Text(node) === question.acceptedAnswer.text),
      `The FAQ answer must match the page: ${question.name}`);
  }
});

test('game actions retain their install destinations and open and close the original overlay', async () => {
  const { render, copy } = await Lobby();
  let elements = render();
  const card = elements.find(node => node.type === 'article');
  const actions = Elements(card);
  assert.ok(actions.some(node => node.type === 'a' && node.props.href === games[0].installUrl));
  actions.find(node => node.type === 'button' && node.props.children.includes(copy.lobby.start)).props.onClick();
  elements = render();
  const overlay = elements.find(node => node.props?.game === games[0]);
  assert.ok(overlay);
  overlay.props.onClose();
  assert.equal(render().some(node => node.props?.game), false);
});
